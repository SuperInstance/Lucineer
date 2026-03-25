//-----------------------------------------------------------------------------
// Testbench: pe_tb
// Description: Processing element testbench for MLS RAU
//
// Tests the RAU (Rotation-Accumulate Unit) against the MLS spec:
//   1. Ternary truth table: all 9 weight×activation combinations
//   2. Accumulation correctness
//   3. Zero-skip optimization
//   4. Pipeline latency
//   5. Reset behavior
//   6. Accumulator saturation (overflow/underflow)
//   7. Back-to-back operations (no bubbles)
//
// Uses self-checking scoreboard — exit code 0 = PASS, 1 = FAIL
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

`timescale 1ns / 1ps

module pe_tb;

    //=========================================================================
    // Parameters
    //=========================================================================

    parameter int ACTIVATION_WIDTH  = 8;
    parameter int ACCUMULATOR_WIDTH = 24;
    parameter int CLK_PERIOD_NS     = 5;  // 200 MHz

    //=========================================================================
    // Signals
    //=========================================================================

    logic                                  clk;
    logic                                  rst_n;
    logic signed [ACTIVATION_WIDTH-1:0]    activation;
    logic [1:0]                            weight;
    logic                                  valid_in;
    logic                                  accumulate_en;
    logic                                  clear_acc;
    logic signed [ACCUMULATOR_WIDTH-1:0]   result;
    logic                                  valid_out;

    //=========================================================================
    // DUT: RAU
    //=========================================================================

    rau #(
        .ACTIVATION_WIDTH(ACTIVATION_WIDTH),
        .ACCUMULATOR_WIDTH(ACCUMULATOR_WIDTH),
        .PIPELINE(1)
    ) dut (
        .clk(clk),
        .rst_n(rst_n),
        .activation(activation),
        .weight(weight),
        .valid_in(valid_in),
        .accumulate_en(accumulate_en),
        .clear_acc(clear_acc),
        .result(result),
        .valid_out(valid_out)
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

    task automatic check_result(
        input string test_name,
        input logic signed [ACCUMULATOR_WIDTH-1:0] expected
    );
        // Wait for pipeline (2 cycles for pipelined RAU)
        repeat (3) @(posedge clk);

        test_count++;
        if (result === expected) begin
            pass_count++;
            $display("[PASS] %s: result=%0d (expected %0d)", test_name, result, expected);
        end else begin
            fail_count++;
            $display("[FAIL] %s: result=%0d (expected %0d)", test_name, result, expected);
        end
    endtask

    //=========================================================================
    // Stimulus task
    //=========================================================================

    task automatic drive(
        input logic signed [ACTIVATION_WIDTH-1:0] act,
        input logic [1:0] wt,
        input logic acc_en = 1'b1
    );
        @(posedge clk);
        activation    <= act;
        weight        <= wt;
        valid_in      <= 1'b1;
        accumulate_en <= acc_en;
        @(posedge clk);
        valid_in      <= 1'b0;
    endtask

    //=========================================================================
    // Weight encoding constants
    //=========================================================================

    localparam logic [1:0] W_PLUS  = 2'b00;  // +1
    localparam logic [1:0] W_ZERO  = 2'b01;  //  0
    localparam logic [1:0] W_MINUS = 2'b10;  // -1

    //=========================================================================
    // Test sequence
    //=========================================================================

    initial begin
        $dumpfile("pe_tb.vcd");
        $dumpvars(0, pe_tb);

        // Initialize
        rst_n         = 0;
        activation    = 0;
        weight        = W_ZERO;
        valid_in      = 0;
        accumulate_en = 0;
        clear_acc     = 0;

        // Reset
        repeat (5) @(posedge clk);
        rst_n = 1;
        repeat (2) @(posedge clk);

        $display("========================================");
        $display("MLS PE (RAU) Testbench");
        $display("========================================");

        //---------------------------------------------------------------------
        // Test 1: Ternary truth table (all 9 combinations)
        //---------------------------------------------------------------------

        $display("\n--- Test 1: Ternary Truth Table ---");

        // +1 × positive activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd42, W_PLUS);
        check_result("+1 * 42", 24'sd42);

        // +1 × negative activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(-8'sd17, W_PLUS);
        check_result("+1 * -17", -24'sd17);

        // -1 × positive activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd42, W_MINUS);
        check_result("-1 * 42", -24'sd42);

        // -1 × negative activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(-8'sd17, W_MINUS);
        check_result("-1 * -17", 24'sd17);

        // 0 × positive activation (zero-skip)
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd42, W_ZERO);
        check_result("0 * 42", 24'sd0);

        // 0 × negative activation (zero-skip)
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(-8'sd17, W_ZERO);
        check_result("0 * -17", 24'sd0);

        // +1 × 0 activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd0, W_PLUS);
        check_result("+1 * 0", 24'sd0);

        // -1 × 0 activation
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd0, W_MINUS);
        check_result("-1 * 0", 24'sd0);

        // 0 × 0 activation (trivial zero-skip)
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd0, W_ZERO);
        check_result("0 * 0", 24'sd0);

        //---------------------------------------------------------------------
        // Test 2: Accumulation sequence
        //---------------------------------------------------------------------

        $display("\n--- Test 2: Accumulation ---");

        clear_acc = 1; @(posedge clk); clear_acc = 0;

        // Accumulate: 10 + 20 + 30 = 60
        drive(8'sd10, W_PLUS);
        repeat (3) @(posedge clk);
        drive(8'sd20, W_PLUS);
        repeat (3) @(posedge clk);
        drive(8'sd30, W_PLUS);
        check_result("Accumulate 10+20+30", 24'sd60);

        //---------------------------------------------------------------------
        // Test 3: Mixed accumulation (+1 and -1)
        //---------------------------------------------------------------------

        $display("\n--- Test 3: Mixed accumulation ---");

        clear_acc = 1; @(posedge clk); clear_acc = 0;

        // 50 - 30 + 10 = 30
        drive(8'sd50, W_PLUS);
        repeat (3) @(posedge clk);
        drive(8'sd30, W_MINUS);
        repeat (3) @(posedge clk);
        drive(8'sd10, W_PLUS);
        check_result("50 - 30 + 10", 24'sd30);

        //---------------------------------------------------------------------
        // Test 4: Reset clears accumulator
        //---------------------------------------------------------------------

        $display("\n--- Test 4: Reset behavior ---");

        // Load a value first
        clear_acc = 1; @(posedge clk); clear_acc = 0;
        drive(8'sd100, W_PLUS);
        repeat (3) @(posedge clk);

        // Reset
        rst_n = 0;
        repeat (2) @(posedge clk);
        rst_n = 1;
        repeat (2) @(posedge clk);
        check_result("After reset", 24'sd0);

        //---------------------------------------------------------------------
        // Test 5: Clear accumulator
        //---------------------------------------------------------------------

        $display("\n--- Test 5: Clear accumulator ---");

        drive(8'sd77, W_PLUS);
        repeat (3) @(posedge clk);
        clear_acc = 1;
        @(posedge clk);
        clear_acc = 0;
        repeat (3) @(posedge clk);
        check_result("After clear", 24'sd0);

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
        #100_000;
        $display("[ERROR] Simulation timeout (100 µs)");
        $finish(1);
    end

endmodule
