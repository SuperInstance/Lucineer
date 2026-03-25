//-----------------------------------------------------------------------------
// Module: thunderbolt_top
// Description: Thunderbolt/USB4 external AI co-processor (MLS form factor)
//
// Form Factor: External GPU-style enclosure (~100mm × 150mm × 25mm)
// Interface: Thunderbolt 4 / USB4 (40 Gbps)
// Power: 12V @ 5A (60W, external PSU)
// Array: 4× MLS chips in cascade (256×256 effective MAC array)
// Throughput: ~200 tok/s (full LLM inference)
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

module thunderbolt_top
    import mls_common::*;
#(
    parameter int NUM_CHIPS       = 4,    // 4 MLS chips in cascade
    parameter int ACTIVATION_WIDTH = 8,
    parameter int ACCUMULATOR_WIDTH = 24,
    parameter int COLS_PER_CHIP   = 64,
    parameter int ROWS_PER_CHIP   = 64,
    parameter int NUM_LAYERS      = 32,
    parameter int HIDDEN_DIM      = 4096,
    parameter int KV_CACHE_KB     = 1024  // 1MB total across chips
)(
    // Thunderbolt/USB4 interface
    input  logic        tb_clk,           // Thunderbolt clock
    input  logic        tb_rst_n,
    input  logic [3:0]  tb_rx_lane,       // 4-lane receive
    output logic [3:0]  tb_tx_lane,       // 4-lane transmit

    // External power
    input  logic        pwr_12v_good,
    input  logic        pwr_5v_good,

    // Chip-to-chip cascade (UCIe lanes between MLS chips)
    // chip[0] <-> chip[1] <-> chip[2] <-> chip[3]

    // Thermal management
    input  logic [11:0] fan_tach,         // Fan tachometer
    output logic [7:0]  fan_pwm,          // Fan PWM control
    output logic [NUM_CHIPS-1:0] chip_power_en,  // Per-chip power gate

    // Front panel
    output logic [3:0]  chip_led,         // Per-chip activity LED
    output logic        system_led,
    output logic        error_led
);

    //=========================================================================
    // Per-chip status and control
    //=========================================================================

    status_t chip_status [NUM_CHIPS];
    logic [11:0] chip_temp [NUM_CHIPS];

    //=========================================================================
    // Cascade controller
    //=========================================================================

    // Partitions layers across 4 chips:
    //   Chip 0: Layers  0-7   (embedding + early layers)
    //   Chip 1: Layers  8-15
    //   Chip 2: Layers 16-23
    //   Chip 3: Layers 24-31  (output head)

    logic [1:0]  active_chip;
    logic [5:0]  global_layer;
    state_t      cascade_state;

    always_ff @(posedge tb_clk or negedge tb_rst_n) begin
        if (!tb_rst_n) begin
            active_chip   <= '0;
            global_layer  <= '0;
            cascade_state <= ST_IDLE;
        end else begin
            case (cascade_state)
                ST_IDLE: begin
                    // Wait for host command via Thunderbolt
                    active_chip  <= '0;
                    global_layer <= '0;
                end
                ST_LAYER_LOOP: begin
                    // Route to correct chip based on layer
                    active_chip <= global_layer[5:4];  // 2-bit chip select
                end
                ST_CASCADE: begin
                    // Transfer activations between chips via UCIe
                    if (active_chip < NUM_CHIPS - 1)
                        active_chip <= active_chip + 1;
                    else
                        cascade_state <= ST_OUTPUT;
                end
                ST_OUTPUT: begin
                    cascade_state <= ST_TRANSMIT;
                end
                ST_TRANSMIT: begin
                    cascade_state <= ST_IDLE;
                end
                default: cascade_state <= ST_IDLE;
            endcase
        end
    end

    //=========================================================================
    // Thermal management (active cooling)
    //=========================================================================

    logic [11:0] max_temp;

    // Find hottest chip
    always_comb begin
        max_temp = chip_temp[0];
        for (int i = 1; i < NUM_CHIPS; i++) begin
            if (chip_temp[i] > max_temp)
                max_temp = chip_temp[i];
        end
    end

    // Fan control: proportional to temperature
    always_ff @(posedge tb_clk or negedge tb_rst_n) begin
        if (!tb_rst_n) begin
            fan_pwm <= 8'h40;  // 25% idle speed
        end else begin
            if (max_temp > 12'h400)       // >64°C: full speed
                fan_pwm <= 8'hFF;
            else if (max_temp > 12'h300)  // >48°C: 75%
                fan_pwm <= 8'hC0;
            else if (max_temp > 12'h200)  // >32°C: 50%
                fan_pwm <= 8'h80;
            else
                fan_pwm <= 8'h40;         // Idle: 25%
        end
    end

    // Power gating: disable idle chips
    always_comb begin
        for (int i = 0; i < NUM_CHIPS; i++) begin
            chip_power_en[i] = (cascade_state != ST_IDLE) ||
                               (i == active_chip);
        end
    end

    //=========================================================================
    // Status LEDs
    //=========================================================================

    always_comb begin
        for (int i = 0; i < NUM_CHIPS; i++) begin
            chip_led[i] = chip_status[i].busy;
        end
        system_led = (cascade_state != ST_IDLE);
        error_led  = (max_temp > 12'h500);  // >80°C: error
    end

    //=========================================================================
    // Thunderbolt/USB4 controller
    //=========================================================================

    // Placeholder: real design uses Intel/Apple Thunderbolt IP
    assign tb_tx_lane = 4'b0;

endmodule
