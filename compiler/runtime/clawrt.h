/**
 * clawrt.h — Mask-Lock Chip Runtime (C API)
 *
 * Provides host-side communication with a clawc-compiled chip via:
 *   - PCIe Gen2 x1  (ASIC, KV260 AXI)
 *   - UART 921600   (debug / Jetson UART)
 *   - SPI 50 MHz    (Jetson SPI0)
 *
 * Usage:
 *   clawrt_handle_t h;
 *   clawrt_open(&h, CLAWRT_TRANSPORT_PCIE, "/dev/clawc0");
 *   clawrt_load_bitstream(&h, "programming.bin");
 *   clawrt_run(&h, input_tokens, n_tokens, logits_out);
 *   clawrt_close(&h);
 */

#pragma once

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ------------------------------------------------------------------ */
/* Version                                                              */
/* ------------------------------------------------------------------ */
#define CLAWRT_VERSION_MAJOR 0
#define CLAWRT_VERSION_MINOR 1
#define CLAWRT_VERSION_PATCH 0

/* ------------------------------------------------------------------ */
/* Transport types                                                      */
/* ------------------------------------------------------------------ */
typedef enum {
    CLAWRT_TRANSPORT_PCIE   = 0,
    CLAWRT_TRANSPORT_UART   = 1,
    CLAWRT_TRANSPORT_SPI    = 2,
    CLAWRT_TRANSPORT_SIM    = 3,   /* Verilator DPI simulation */
} clawrt_transport_t;

/* ------------------------------------------------------------------ */
/* Status codes                                                         */
/* ------------------------------------------------------------------ */
typedef enum {
    CLAWRT_OK               =  0,
    CLAWRT_ERR_IO           = -1,
    CLAWRT_ERR_TIMEOUT      = -2,
    CLAWRT_ERR_INVALID_ARG  = -3,
    CLAWRT_ERR_NOT_READY    = -4,
    CLAWRT_ERR_OVERFLOW     = -5,
    CLAWRT_ERR_CHECKSUM     = -6,
    CLAWRT_ERR_UNSUPPORTED  = -7,
} clawrt_status_t;

/* ------------------------------------------------------------------ */
/* Handle                                                               */
/* ------------------------------------------------------------------ */
typedef struct {
    clawrt_transport_t  transport;
    int                 fd;             /* file descriptor (PCIe/UART/SPI) */
    void               *sim_ctx;        /* simulation context (transport=SIM) */
    uint32_t            base_addr;      /* PCIe BAR0 base */
    uint32_t            clk_hz;         /* chip clock frequency */
    uint32_t            n_chips;        /* cascade chain length */
    uint32_t            vocab_size;     /* from bitstream header */
    uint32_t            hidden_size;
    uint32_t            n_layers;
    int                 is_open;
    char                device_path[256];
} clawrt_handle_t;

/* ------------------------------------------------------------------ */
/* Bitstream header (matches clawc output format)                      */
/* ------------------------------------------------------------------ */
typedef struct {
    uint8_t  magic[4];          /* "CLWC" */
    uint16_t version_major;
    uint16_t version_minor;
    uint32_t n_tensors;
    uint32_t vocab_size;
    uint32_t hidden_size;
    uint32_t n_layers;
    uint32_t n_chips;
    uint32_t checksum;          /* CRC32 of payload */
} clawrt_bitstream_header_t;

/* ------------------------------------------------------------------ */
/* Run context                                                          */
/* ------------------------------------------------------------------ */
typedef struct {
    uint32_t  max_tokens;
    uint32_t  temperature_q8;   /* Q8 fixed-point, 0..255 */
    uint32_t  top_k;
    int       greedy;           /* 1=greedy, 0=sampled */
    uint32_t  timeout_ms;
} clawrt_run_config_t;

/* ------------------------------------------------------------------ */
/* Inference output                                                     */
/* ------------------------------------------------------------------ */
typedef struct {
    int32_t  *logits;           /* [vocab_size] — caller-allocated */
    uint32_t  n_logits;
    uint32_t  cycles_taken;
    float     tokens_per_second;
    uint32_t  power_mw;         /* from on-chip power monitor, 0 if unavailable */
} clawrt_output_t;

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/**
 * Open a connection to the chip.
 * @param h         Handle to initialize
 * @param transport CLAWRT_TRANSPORT_*
 * @param device    Device path ("/dev/clawc0", "/dev/ttyS0", "/dev/spidev0.0")
 */
clawrt_status_t clawrt_open(clawrt_handle_t *h,
                             clawrt_transport_t transport,
                             const char *device);

/**
 * Close the connection and release resources.
 */
clawrt_status_t clawrt_close(clawrt_handle_t *h);

/**
 * Load a clawc bitstream (.bin) onto the chip.
 * For ASIC: programs the weight scratchpad (non-ROM residuals).
 * For FPGA: full bitstream programming via JTAG bridge.
 */
clawrt_status_t clawrt_load_bitstream(clawrt_handle_t *h,
                                       const char *bitstream_path);

/**
 * Run a single inference pass.
 * @param h          Handle
 * @param tokens     Input token IDs [n_tokens]
 * @param n_tokens   Number of tokens (sequence length)
 * @param out        Output struct — logits buffer must be caller-allocated
 * @param cfg        Run configuration (NULL = defaults)
 */
clawrt_status_t clawrt_run(clawrt_handle_t *h,
                            const uint32_t *tokens,
                            uint32_t        n_tokens,
                            clawrt_output_t *out,
                            const clawrt_run_config_t *cfg);

/**
 * Write a 32-bit CSR register.
 */
clawrt_status_t clawrt_csr_write(clawrt_handle_t *h,
                                  uint32_t offset,
                                  uint32_t value);

/**
 * Read a 32-bit CSR register.
 */
clawrt_status_t clawrt_csr_read(clawrt_handle_t *h,
                                 uint32_t offset,
                                 uint32_t *value);

/**
 * Reset the chip (assert rst_n low for ≥10 clock cycles).
 */
clawrt_status_t clawrt_reset(clawrt_handle_t *h);

/**
 * Query chip identification.
 */
clawrt_status_t clawrt_get_info(clawrt_handle_t *h,
                                 clawrt_bitstream_header_t *info_out);

/**
 * Return a human-readable error string for a status code.
 */
const char *clawrt_strerror(clawrt_status_t status);

/* ------------------------------------------------------------------ */
/* CSR register map                                                     */
/* ------------------------------------------------------------------ */
#define CLAWRT_CSR_CONTROL       0x00   /* [0]=start, [1]=reset        */
#define CLAWRT_CSR_STATUS        0x04   /* [0]=done, [1]=busy, [7:4]=err */
#define CLAWRT_CSR_N_TOKENS      0x08   /* sequence length             */
#define CLAWRT_CSR_CLK_HZ        0x0C   /* read-only: chip clock       */
#define CLAWRT_CSR_POWER_MW      0x10   /* read-only: power monitor    */
#define CLAWRT_CSR_CYCLE_COUNT   0x14   /* read-only: cycles for last run */
#define CLAWRT_CSR_SCRATCH       0x18   /* read/write: debug scratch   */

#ifdef __cplusplus
}
#endif
