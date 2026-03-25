//-----------------------------------------------------------------------------
// Module: genesys2_cascade_top
// Description: Multi-FPGA cascade demo on Digilent Genesys 2
//
// FPGA Prototype: Demonstrates MLS cascade protocol across multiple boards
// Target: 2× Digilent Genesys 2 (Xilinx Kintex-7 XC7K325T)
// Connection: UART bridge between boards (cascade link)
//
// Board A: Layers 0-11 (front half of model)
// Board B: Layers 12-23 (back half of model)
// Cascade: Board A sends activations to Board B via UART/SPI
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

module genesys2_cascade_top
    import mls_common::*;
#(
    parameter bit IS_FRONT_HALF = 1,  // 1 = Board A (layers 0-11)
    parameter int NUM_LOCAL_LAYERS = 12,
    parameter int NUM_COLUMNS = 16,
    parameter int NUM_ROWS    = 16
)(
    // Genesys 2 system clock
    input  logic        sys_clk_200mhz,
    input  logic        rst_n,

    // Cascade UART link (between boards)
    input  logic        cascade_rx,
    output logic        cascade_tx,

    // USB-UART (host debug)
    input  logic        uart_rx,
    output logic        uart_tx,

    // Genesys 2 LEDs
    output logic [7:0]  led,

    // Genesys 2 7-segment display
    output logic [6:0]  seg,
    output logic [7:0]  an
);

    //=========================================================================
    // Cascade protocol
    //=========================================================================

    // Inter-board communication:
    // 1. Board A receives input from host via USB-UART
    // 2. Board A processes layers 0-11
    // 3. Board A sends activations to Board B via cascade UART
    // 4. Board B processes layers 12-23
    // 5. Board B sends result back to Board A
    // 6. Board A returns result to host

    logic [7:0]  cascade_tx_data;
    logic        cascade_tx_valid;
    logic        cascade_tx_ready;
    logic [7:0]  cascade_rx_data;
    logic        cascade_rx_valid;

    state_t local_state;
    logic [5:0] local_layer;

    //=========================================================================
    // Inference array (16×16)
    //=========================================================================

    logic signed [7:0]  activations_in [NUM_COLUMNS];
    logic signed [23:0] partial_sums   [NUM_COLUMNS];
    logic [1:0]  weights [NUM_COLUMNS][NUM_ROWS];

    synaptic_array #(
        .ACTIVATION_WIDTH(8),
        .ACCUMULATOR_WIDTH(24),
        .NUM_COLUMNS(NUM_COLUMNS),
        .NUM_ROWS(NUM_ROWS)
    ) u_array (
        .clk(sys_clk_200mhz),
        .rst_n(rst_n),
        .activations_in(activations_in),
        .activations_out(),
        .weights(weights),
        .partial_sums(partial_sums),
        .compute_enable(local_state == ST_LAYER_LOOP),
        .clear_accumulator(local_state == ST_IDLE)
    );

    //=========================================================================
    // Main FSM
    //=========================================================================

    always_ff @(posedge sys_clk_200mhz or negedge rst_n) begin
        if (!rst_n) begin
            local_state <= ST_IDLE;
            local_layer <= '0;
        end else begin
            case (local_state)
                ST_IDLE: begin
                    if (IS_FRONT_HALF) begin
                        // Board A: wait for host input
                        if (cascade_rx_valid)
                            local_state <= ST_RECEIVE;
                    end else begin
                        // Board B: wait for cascade input
                        if (cascade_rx_valid)
                            local_state <= ST_RECEIVE;
                    end
                end
                ST_RECEIVE:    local_state <= ST_LAYER_LOOP;
                ST_LAYER_LOOP: local_state <= ST_MLP;
                ST_MLP: begin
                    if (local_layer < NUM_LOCAL_LAYERS - 1) begin
                        local_layer <= local_layer + 1;
                        local_state <= ST_LAYER_LOOP;
                    end else begin
                        local_layer <= '0;
                        local_state <= ST_CASCADE;
                    end
                end
                ST_CASCADE: begin
                    // Send activations to other board
                    local_state <= ST_TRANSMIT;
                end
                ST_TRANSMIT: local_state <= ST_IDLE;
                default:     local_state <= ST_IDLE;
            endcase
        end
    end

    //=========================================================================
    // Status LEDs
    //=========================================================================

    assign led[0] = (local_state == ST_IDLE);       // Ready
    assign led[1] = (local_state == ST_LAYER_LOOP); // Computing
    assign led[2] = (local_state == ST_CASCADE);    // Cascading
    assign led[3] = (local_state == ST_TRANSMIT);   // Transmitting
    assign led[4] = IS_FRONT_HALF;                  // Board A indicator
    assign led[5] = !IS_FRONT_HALF;                 // Board B indicator
    assign led[7:6] = local_layer[1:0];             // Layer counter (low bits)

    // 7-segment: show current layer
    assign seg = 7'b0;  // Placeholder
    assign an  = 8'hFE; // Enable first digit

    // UART placeholder
    assign uart_tx = 1'b1;
    assign cascade_tx = 1'b1;

endmodule
