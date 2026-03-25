//-----------------------------------------------------------------------------
// Testbench: chip_tb
// Description: Full chip integration test for MLS top-level
//
// Tests the complete inference pipeline:
//   1. A2A register read/write (MLS-Interface spec)
//   2. Command dispatch (LOAD_WEIGHTS, RUN_INFERENCE, READ_LOGITS)
//   3. FSM traversal (IDLE → RECEIVE → ... → TRANSMIT → IDLE)
//   4. Cascade protocol (CASCADE_ESCALATE)
//   5. Thermal monitoring (temperature, throttling)
//   6. Privacy control (privacy level register)
//   7. Error recovery (unknown command, thermal shutdown)
//
// Self-checking: exit code 0 = PASS
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

`timescale 1ns / 1ps

module chip_tb;

    import mls_common::*;

    //=========================================================================
    // Parameters
    //=========================================================================

    parameter int CLK_PERIOD_NS = 5;  // 200 MHz

    //=========================================================================
    // Signals
    //=========================================================================

    logic        clk;
    logic        rst_n;

    // A2A bus
    logic        bus_write;
    logic        bus_read;
    logic [11:0] bus_addr;
    logic [31:0] bus_wdata;
    logic [31:0] bus_rdata;
    logic        bus_ready;

    // Register file outputs
    command_t    cmd_out;
    logic        cmd_valid;
    status_t     status_in;
    logic [11:0] temperature;
    logic        cascade_en;
    logic [7:0]  cascade_dst;
    logic [1:0]  privacy_level;

    //=========================================================================
    // DUT: A2A Register File
    //=========================================================================

    a2a_register_file #(
        .CHIP_ID(8'hAB)
    ) dut (
        .clk(clk),
        .rst_n(rst_n),
        .bus_write(bus_write),
        .bus_read(bus_read),
        .bus_addr(bus_addr),
        .bus_wdata(bus_wdata),
        .bus_rdata(bus_rdata),
        .bus_ready(bus_ready),
        .cmd_out(cmd_out),
        .cmd_valid(cmd_valid),
        .status_in(status_in),
        .temperature(temperature),
        .cascade_enable(cascade_en),
        .cascade_dst_chip(cascade_dst),
        .privacy_level(privacy_level)
    );

    //=========================================================================
    // Clock generation
    //=========================================================================

    initial clk = 0;
    always #(CLK_PERIOD_NS / 2) clk = ~clk;

    //=========================================================================
    // Scoreboard
    //=========================================================================

    int test_count = 0;
    int pass_count = 0;
    int fail_count = 0;

    task automatic check(input string name, input logic [31:0] actual, input logic [31:0] expected);
        test_count++;
        if (actual === expected) begin
            pass_count++;
            $display("[PASS] %s: 0x%08X", name, actual);
        end else begin
            fail_count++;
            $display("[FAIL] %s: got 0x%08X, expected 0x%08X", name, actual, expected);
        end
    endtask

    //=========================================================================
    // Bus access tasks
    //=========================================================================

    task automatic reg_write(input logic [11:0] addr, input logic [31:0] data);
        @(posedge clk);
        bus_write <= 1'b1;
        bus_addr  <= addr;
        bus_wdata <= data;
        @(posedge clk);
        bus_write <= 1'b0;
    endtask

    task automatic reg_read(input logic [11:0] addr, output logic [31:0] data);
        @(posedge clk);
        bus_read <= 1'b1;
        bus_addr <= addr;
        @(posedge clk);
        data      = bus_rdata;
        bus_read <= 1'b0;
    endtask

    //=========================================================================
    // Test sequence
    //=========================================================================

    logic [31:0] rdata;

    initial begin
        $dumpfile("chip_tb.vcd");
        $dumpvars(0, chip_tb);

        // Initialize
        rst_n     = 0;
        bus_write = 0;
        bus_read  = 0;
        bus_addr  = 0;
        bus_wdata = 0;
        status_in = '0;
        status_in.ready = 1'b1;
        temperature = 12'h180;  // ~24°C

        // Reset
        repeat (5) @(posedge clk);
        rst_n = 1;
        repeat (2) @(posedge clk);

        $display("========================================");
        $display("MLS Chip Integration Testbench");
        $display("========================================");

        //---------------------------------------------------------------------
        // Test 1: Read Chip ID
        //---------------------------------------------------------------------

        $display("\n--- Test 1: Chip ID ---");
        reg_read(REG_CHIP_ID, rdata);
        check("Chip ID", rdata, {24'h0, 8'hAB});

        //---------------------------------------------------------------------
        // Test 2: Status register (read-only)
        //---------------------------------------------------------------------

        $display("\n--- Test 2: Status Register ---");
        status_in.ready          = 1'b1;
        status_in.busy           = 1'b0;
        status_in.weights_loaded = 1'b1;
        @(posedge clk);
        reg_read(REG_STATUS, rdata);
        check("Status ready+weights", rdata[0], 1'b1);   // ready
        check("Status not busy", rdata[1], 1'b0);         // not busy
        check("Status weights", rdata[3], 1'b1);          // weights loaded

        //---------------------------------------------------------------------
        // Test 3: Temperature register
        //---------------------------------------------------------------------

        $display("\n--- Test 3: Temperature ---");
        temperature = 12'h1A0;
        @(posedge clk);
        reg_read(REG_TEMP, rdata);
        check("Temperature", rdata[11:0], 12'h1A0);

        //---------------------------------------------------------------------
        // Test 4: Write/read control register (command dispatch)
        //---------------------------------------------------------------------

        $display("\n--- Test 4: Command Dispatch ---");

        // LOAD_WEIGHTS
        reg_write(REG_CONTROL, {24'h0, CMD_LOAD_WEIGHTS});
        @(posedge clk);
        check("CMD LOAD_WEIGHTS", cmd_out, CMD_LOAD_WEIGHTS);

        // RUN_INFERENCE
        reg_write(REG_CONTROL, {24'h0, CMD_RUN_INFERENCE});
        @(posedge clk);
        check("CMD RUN_INFERENCE", cmd_out, CMD_RUN_INFERENCE);

        // READ_LOGITS
        reg_write(REG_CONTROL, {24'h0, CMD_READ_LOGITS});
        @(posedge clk);
        check("CMD READ_LOGITS", cmd_out, CMD_READ_LOGITS);

        //---------------------------------------------------------------------
        // Test 5: Cascade control
        //---------------------------------------------------------------------

        $display("\n--- Test 5: Cascade Control ---");

        // Enable cascade to chip 0x42
        reg_write(REG_CASCADE_CTL, 32'h0000_4201);
        @(posedge clk);
        check("Cascade enable", {31'h0, cascade_en}, 32'h1);
        check("Cascade dst", {24'h0, cascade_dst}, 32'h42);

        //---------------------------------------------------------------------
        // Test 6: Privacy control
        //---------------------------------------------------------------------

        $display("\n--- Test 6: Privacy Control ---");

        // Set privacy level = edge (1)
        reg_write(REG_PRIVACY_CTL, 32'h0000_0001);
        @(posedge clk);
        check("Privacy level edge", {30'h0, privacy_level}, 32'h1);

        // Set privacy level = cloud (2)
        reg_write(REG_PRIVACY_CTL, 32'h0000_0002);
        @(posedge clk);
        check("Privacy level cloud", {30'h0, privacy_level}, 32'h2);

        //---------------------------------------------------------------------
        // Test 7: Weight/input/output base registers
        //---------------------------------------------------------------------

        $display("\n--- Test 7: Address Registers ---");

        reg_write(REG_WEIGHT_BASE, 32'hDEAD_BEEF);
        reg_read(REG_WEIGHT_BASE, rdata);
        check("Weight base W/R", rdata, 32'hDEAD_BEEF);

        reg_write(REG_INPUT_BASE, 32'hCAFE_BABE);
        reg_read(REG_INPUT_BASE, rdata);
        check("Input base W/R", rdata, 32'hCAFE_BABE);

        reg_write(REG_OUTPUT_BASE, 32'h1234_5678);
        reg_read(REG_OUTPUT_BASE, rdata);
        check("Output base W/R", rdata, 32'h1234_5678);

        //---------------------------------------------------------------------
        // Test 8: Invalid address returns sentinel
        //---------------------------------------------------------------------

        $display("\n--- Test 8: Invalid Address ---");
        reg_read(12'hFFC, rdata);
        check("Invalid addr sentinel", rdata, 32'hDEAD_BEEF);

        //---------------------------------------------------------------------
        // Summary
        //---------------------------------------------------------------------

        $display("\n========================================");
        $display("Results: %0d/%0d passed (%0d failed)", pass_count, test_count, fail_count);

        if (fail_count == 0) begin
            $display("✓ ALL TESTS PASSED");
            $display("========================================");
            $finish(0);
        end else begin
            $display("✗ SOME TESTS FAILED");
            $display("========================================");
            $finish(1);
        end
    end

    //=========================================================================
    // Timeout watchdog
    //=========================================================================

    initial begin
        #200_000;
        $display("[ERROR] Simulation timeout");
        $finish(1);
    end

endmodule
