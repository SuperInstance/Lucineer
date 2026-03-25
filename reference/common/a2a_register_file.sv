//-----------------------------------------------------------------------------
// Module: a2a_register_file
// Description: MLS-Interface compliant register file for A2A protocol
//
// Implements the standard register map at base address 0x1000.
// All form factors instantiate this for host communication.
//
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//-----------------------------------------------------------------------------

module a2a_register_file
    import mls_common::*;
#(
    parameter logic [7:0] CHIP_ID = 8'h01
)(
    input  logic        clk,
    input  logic        rst_n,

    // Host bus interface (memory-mapped)
    input  logic        bus_write,
    input  logic        bus_read,
    input  logic [11:0] bus_addr,
    input  logic [31:0] bus_wdata,
    output logic [31:0] bus_rdata,
    output logic        bus_ready,

    // Internal control outputs
    output command_t    cmd_out,
    output logic        cmd_valid,
    input  status_t     status_in,
    input  logic [11:0] temperature,

    // Cascade interface
    output logic        cascade_enable,
    output logic [7:0]  cascade_dst_chip,

    // Privacy interface
    output logic [1:0]  privacy_level
);

    //=========================================================================
    // Register storage
    //=========================================================================

    logic [31:0] control_reg;
    logic [31:0] weight_base_reg;
    logic [31:0] weight_size_reg;
    logic [31:0] input_base_reg;
    logic [31:0] output_base_reg;
    logic [31:0] cascade_ctl_reg;
    logic [31:0] privacy_ctl_reg;

    //=========================================================================
    // Write logic
    //=========================================================================

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            control_reg     <= 32'h0;
            weight_base_reg <= 32'h0;
            weight_size_reg <= 32'h0;
            input_base_reg  <= 32'h0;
            output_base_reg <= 32'h0;
            cascade_ctl_reg <= 32'h0;
            privacy_ctl_reg <= 32'h0;
        end else if (bus_write) begin
            case (bus_addr)
                REG_CONTROL:     control_reg     <= bus_wdata;
                REG_WEIGHT_BASE: weight_base_reg <= bus_wdata;
                REG_WEIGHT_SIZE: weight_size_reg <= bus_wdata;
                REG_INPUT_BASE:  input_base_reg  <= bus_wdata;
                REG_OUTPUT_BASE: output_base_reg <= bus_wdata;
                REG_CASCADE_CTL: cascade_ctl_reg <= bus_wdata;
                REG_PRIVACY_CTL: privacy_ctl_reg <= bus_wdata;
                default: ;  // Ignore writes to read-only registers
            endcase
        end
    end

    //=========================================================================
    // Read logic
    //=========================================================================

    always_comb begin
        bus_rdata = 32'h0;
        case (bus_addr)
            REG_CONTROL:     bus_rdata = control_reg;
            REG_STATUS:      bus_rdata = status_in;
            REG_WEIGHT_BASE: bus_rdata = weight_base_reg;
            REG_WEIGHT_SIZE: bus_rdata = weight_size_reg;
            REG_INPUT_BASE:  bus_rdata = input_base_reg;
            REG_OUTPUT_BASE: bus_rdata = output_base_reg;
            REG_CHIP_ID:     bus_rdata = {24'h0, CHIP_ID};
            REG_TEMP:        bus_rdata = {20'h0, temperature};
            REG_CASCADE_CTL: bus_rdata = cascade_ctl_reg;
            REG_PRIVACY_CTL: bus_rdata = privacy_ctl_reg;
            default:         bus_rdata = 32'hDEAD_BEEF;
        endcase
    end

    assign bus_ready = 1'b1;  // Single-cycle access

    //=========================================================================
    // Command decode
    //=========================================================================

    assign cmd_out   = command_t'(control_reg[7:0]);
    assign cmd_valid = bus_write && (bus_addr == REG_CONTROL);

    //=========================================================================
    // Cascade / Privacy decode
    //=========================================================================

    assign cascade_enable   = cascade_ctl_reg[0];
    assign cascade_dst_chip = cascade_ctl_reg[15:8];
    assign privacy_level    = privacy_ctl_reg[1:0];

endmodule
