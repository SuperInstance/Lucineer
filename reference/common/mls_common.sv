//-----------------------------------------------------------------------------
// Package: mls_common
// Description: Shared types and parameters for all MLS form factors
//
// MLS (Mask-Lock Standard) v1.0 Common Definitions
// Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
// MIT License
//
// All form factors share these types, ensuring interoperability.
//-----------------------------------------------------------------------------

package mls_common;

    //=========================================================================
    // Weight encoding (MLS-Quantization spec)
    //=========================================================================

    typedef enum logic [1:0] {
        W_PLUS_ONE  = 2'b00,  // +1: pass activation
        W_ZERO      = 2'b01,  //  0: no contribution (zero-skip)
        W_MINUS_ONE = 2'b10,  // -1: negate activation
        W_RESERVED  = 2'b11   // Reserved (illegal)
    } weight_t;

    //=========================================================================
    // A2A Register Map (MLS-Interface spec, base 0x1000)
    //=========================================================================

    typedef enum logic [11:0] {
        REG_CONTROL     = 12'h000,  // Control register
        REG_STATUS      = 12'h004,  // Status register
        REG_WEIGHT_BASE = 12'h008,  // Weight start address
        REG_WEIGHT_SIZE = 12'h00C,  // Weight size (bytes)
        REG_INPUT_BASE  = 12'h010,  // Input buffer base
        REG_OUTPUT_BASE = 12'h014,  // Output buffer base
        REG_CHIP_ID     = 12'h018,  // Chip identification
        REG_TEMP        = 12'h01C,  // Temperature sensor
        REG_CASCADE_CTL = 12'h020,  // Cascade control
        REG_PRIVACY_CTL = 12'h024   // Privacy escrow control
    } reg_addr_t;

    //=========================================================================
    // A2A Commands (MLS-Interface spec)
    //=========================================================================

    typedef enum logic [7:0] {
        CMD_NOP              = 8'h00,
        CMD_LOAD_WEIGHTS     = 8'h01,
        CMD_RUN_INFERENCE    = 8'h02,
        CMD_READ_LOGITS      = 8'h03,
        CMD_CASCADE_ESCALATE = 8'h04,
        CMD_PRIVACY_REDACT   = 8'h05,
        CMD_RESET            = 8'hFF
    } command_t;

    //=========================================================================
    // Status bits
    //=========================================================================

    typedef struct packed {
        logic [23:0] reserved;
        logic        cascade_active;
        logic        privacy_enabled;
        logic        thermal_warning;
        logic        weights_loaded;
        logic        error;
        logic        inference_done;
        logic        busy;
        logic        ready;
    } status_t;

    //=========================================================================
    // Inference FSM states
    //=========================================================================

    typedef enum logic [3:0] {
        ST_IDLE         = 4'h0,
        ST_LOAD_WEIGHTS = 4'h1,
        ST_RECEIVE      = 4'h2,
        ST_TOKENIZE     = 4'h3,
        ST_EMBED        = 4'h4,
        ST_LAYER_LOOP   = 4'h5,
        ST_ATTENTION    = 4'h6,
        ST_MLP          = 4'h7,
        ST_OUTPUT       = 4'h8,
        ST_TRANSMIT     = 4'h9,
        ST_CASCADE      = 4'hA,
        ST_ERROR        = 4'hF
    } state_t;

    //=========================================================================
    // Power domain enumeration
    //=========================================================================

    typedef enum logic [1:0] {
        PD_CORE = 2'b00,  // Core logic (1.0V)
        PD_IO   = 2'b01,  // I/O ring (1.8V / 3.3V)
        PD_CTRL = 2'b10   // Control/always-on (1.0V)
    } power_domain_t;

    //=========================================================================
    // Cascade packet (multi-chip communication)
    //=========================================================================

    typedef struct packed {
        logic [7:0]  src_chip_id;
        logic [7:0]  dst_chip_id;
        logic [7:0]  command;
        logic [7:0]  privacy_level;  // 0=local, 1=edge, 2=cloud
        logic [31:0] payload_size;
    } cascade_header_t;

endpackage
