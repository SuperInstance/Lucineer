//-----------------------------------------------------------------------------
// Module: m2_card_top
// Description: NVMe M.2 2230 inference accelerator (MLS form factor)
//
// Form Factor: M.2 2230 (22mm × 30mm), Key M
// Interface: PCIe Gen3 x2 (~16 Gbps)
// Power: 3.3V @ 2A (7W max, M.2 spec)
// Array: 64×64 RAU (4096 ternary MACs)
// Throughput: ~50 tok/s (local LLM assistant)
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

module m2_card_top
    import mls_common::*;
#(
    parameter int ACTIVATION_WIDTH  = 8,
    parameter int ACCUMULATOR_WIDTH = 24,
    parameter int NUM_COLUMNS       = 64,  // Full 64×64 array
    parameter int NUM_ROWS          = 64,
    parameter int NUM_LAYERS        = 24,
    parameter int HIDDEN_DIM        = 1024,
    parameter int KV_CACHE_KB       = 256  // 256KB on-die SRAM
)(
    // PCIe interface
    input  logic        pcie_refclk_p,    // 100MHz reference
    input  logic        pcie_refclk_n,
    input  logic [1:0]  pcie_rx_p,        // Gen3 x2 receive
    input  logic [1:0]  pcie_rx_n,
    output logic [1:0]  pcie_tx_p,        // Gen3 x2 transmit
    output logic [1:0]  pcie_tx_n,
    input  logic        pcie_perst_n,     // PCIe reset

    // M.2 power
    input  logic        vcc_3v3,          // 3.3V main
    input  logic        vcc_1v8,          // 1.8V auxiliary

    // Clock and reset
    input  logic        clk,              // Core clock (from PLL)
    input  logic        rst_n,

    // Status
    output logic        led_activity,
    output logic [1:0]  perf_counter      // Performance monitoring
);

    //=========================================================================
    // PCIe Endpoint (Gen3 x2)
    //=========================================================================

    // PCIe TLP interface (simplified)
    logic [31:0] tlp_addr;
    logic [31:0] tlp_wdata;
    logic [31:0] tlp_rdata;
    logic        tlp_write;
    logic        tlp_read;
    logic        tlp_complete;

    // BAR0: Register space (4KB)
    // BAR1: DMA buffer (1MB)
    pcie_endpoint_lite u_pcie (
        .refclk_p(pcie_refclk_p),
        .refclk_n(pcie_refclk_n),
        .rx_p(pcie_rx_p),
        .rx_n(pcie_rx_n),
        .tx_p(pcie_tx_p),
        .tx_n(pcie_tx_n),
        .perst_n(pcie_perst_n),
        .clk_out(clk),
        .rst_out_n(),
        .bar0_addr(tlp_addr[11:0]),
        .bar0_wdata(tlp_wdata),
        .bar0_rdata(tlp_rdata),
        .bar0_write(tlp_write),
        .bar0_read(tlp_read),
        .bar0_complete(tlp_complete)
    );

    //=========================================================================
    // A2A Register File
    //=========================================================================

    command_t    cmd;
    logic        cmd_valid;
    status_t     chip_status;
    logic [11:0] temperature;
    logic        cascade_en;
    logic [7:0]  cascade_dst;
    logic [1:0]  priv_level;

    a2a_register_file #(
        .CHIP_ID(8'h20)  // M.2 card ID range: 0x20-0x2F
    ) u_regs (
        .clk(clk),
        .rst_n(rst_n),
        .bus_write(tlp_write),
        .bus_read(tlp_read),
        .bus_addr(tlp_addr[11:0]),
        .bus_wdata(tlp_wdata),
        .bus_rdata(tlp_rdata),
        .bus_ready(tlp_complete),
        .cmd_out(cmd),
        .cmd_valid(cmd_valid),
        .status_in(chip_status),
        .temperature(temperature),
        .cascade_enable(cascade_en),
        .cascade_dst_chip(cascade_dst),
        .privacy_level(priv_level)
    );

    //=========================================================================
    // Inference Engine (64×64 RAU array)
    //=========================================================================

    logic signed [ACTIVATION_WIDTH-1:0]  activations_in [NUM_COLUMNS];
    logic signed [ACCUMULATOR_WIDTH-1:0] partial_sums   [NUM_COLUMNS];
    logic [1:0]  weights [NUM_COLUMNS][NUM_ROWS];

    state_t current_state;
    logic [5:0] layer_counter;

    synaptic_array #(
        .ACTIVATION_WIDTH(ACTIVATION_WIDTH),
        .ACCUMULATOR_WIDTH(ACCUMULATOR_WIDTH),
        .NUM_COLUMNS(NUM_COLUMNS),
        .NUM_ROWS(NUM_ROWS)
    ) u_array (
        .clk(clk),
        .rst_n(rst_n),
        .activations_in(activations_in),
        .activations_out(),
        .weights(weights),
        .partial_sums(partial_sums),
        .compute_enable(current_state == ST_LAYER_LOOP ||
                        current_state == ST_MLP ||
                        current_state == ST_ATTENTION),
        .clear_accumulator(current_state == ST_IDLE)
    );

    //=========================================================================
    // Weight ROM (mask-locked)
    //=========================================================================

    weight_rom #(
        .NUM_LAYERS(NUM_LAYERS),
        .HIDDEN_DIM(HIDDEN_DIM),
        .NUM_COLUMNS(NUM_COLUMNS),
        .NUM_ROWS(NUM_ROWS)
    ) u_weights (
        .clk(clk),
        .rst_n(rst_n),
        .layer_select(layer_counter),
        .column_select(12'h0),
        .weights(weights),
        .rom_enable(current_state != ST_IDLE)
    );

    //=========================================================================
    // KV Cache (256KB SRAM)
    //=========================================================================

    kv_cache #(
        .CACHE_SIZE(KV_CACHE_KB * 1024),
        .DATA_WIDTH(64),
        .NUM_HEADS(16)
    ) u_kv (
        .clk(clk),
        .rst_n(rst_n),
        .write_enable(1'b0),
        .read_enable(1'b0),
        .address('0),
        .write_data('0),
        .read_data(),
        .cache_clear(current_state == ST_IDLE && cmd_valid)
    );

    //=========================================================================
    // DMA Engine (PCIe Bus Master)
    //=========================================================================

    // DMA for bulk data transfer (input tokens, output logits)
    // Host allocates buffer, writes address to BAR0 registers
    // Chip DMAs data in/out autonomously

    logic        dma_busy;
    logic [31:0] dma_host_addr;
    logic [15:0] dma_length;

    // Placeholder: real implementation uses PCIe TLP generator
    assign dma_busy = 1'b0;

    //=========================================================================
    // Main FSM
    //=========================================================================

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            current_state <= ST_IDLE;
            layer_counter <= '0;
        end else begin
            case (current_state)
                ST_IDLE: begin
                    if (cmd_valid && cmd == CMD_RUN_INFERENCE)
                        current_state <= ST_RECEIVE;
                end
                ST_RECEIVE:   current_state <= ST_TOKENIZE;
                ST_TOKENIZE:  current_state <= ST_EMBED;
                ST_EMBED:     current_state <= ST_LAYER_LOOP;
                ST_LAYER_LOOP: current_state <= ST_ATTENTION;
                ST_ATTENTION:  current_state <= ST_MLP;
                ST_MLP: begin
                    if (layer_counter < NUM_LAYERS - 1) begin
                        layer_counter <= layer_counter + 1;
                        current_state <= ST_LAYER_LOOP;
                    end else begin
                        layer_counter <= '0;
                        current_state <= ST_OUTPUT;
                    end
                end
                ST_OUTPUT:   current_state <= ST_TRANSMIT;
                ST_TRANSMIT: current_state <= ST_IDLE;
                default:     current_state <= ST_IDLE;
            endcase
        end
    end

    //=========================================================================
    // Thermal management
    //=========================================================================

    // 7W power budget with active thermal monitoring
    logic thermal_throttle;

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            temperature <= 12'h120;
        else if (current_state != ST_IDLE) begin
            if (temperature < 12'h500)  // Max ~80°C (M.2 limit)
                temperature <= temperature + 1;
        end else begin
            if (temperature > 12'h120)
                temperature <= temperature - 1;
        end
    end

    assign thermal_throttle = (temperature > 12'h480);  // Throttle at ~72°C

    //=========================================================================
    // Status
    //=========================================================================

    always_comb begin
        chip_status = '0;
        chip_status.ready          = (current_state == ST_IDLE);
        chip_status.busy           = (current_state != ST_IDLE);
        chip_status.weights_loaded = 1'b1;
        chip_status.thermal_warning = thermal_throttle;
        chip_status.cascade_active  = cascade_en;
        chip_status.privacy_enabled = (priv_level != 2'b00);
    end

    assign led_activity  = chip_status.busy;
    assign perf_counter  = {thermal_throttle, chip_status.busy};

endmodule

//-----------------------------------------------------------------------------
// Stub: PCIe Endpoint Lite (would use IP in real design)
//-----------------------------------------------------------------------------

module pcie_endpoint_lite (
    input  logic        refclk_p,
    input  logic        refclk_n,
    input  logic [1:0]  rx_p, rx_n,
    output logic [1:0]  tx_p, tx_n,
    input  logic        perst_n,
    output logic        clk_out,
    output logic        rst_out_n,
    output logic [11:0] bar0_addr,
    output logic [31:0] bar0_wdata,
    input  logic [31:0] bar0_rdata,
    output logic        bar0_write,
    output logic        bar0_read,
    input  logic        bar0_complete
);

    // Placeholder - real design uses PCIe hard IP or soft core
    assign tx_p = 2'b0;
    assign tx_n = 2'b0;
    assign clk_out = refclk_p;
    assign rst_out_n = perst_n;
    assign bar0_addr = 12'h0;
    assign bar0_wdata = 32'h0;
    assign bar0_write = 1'b0;
    assign bar0_read = 1'b0;

endmodule
