# USB-C Dongle Timing Constraints (SDC)
# MLS Form Factor: USB-C Alt Mode Dongle
# Target: sky130 / gf180

# Clock definitions
create_clock -name clk_usb  -period 20.833 [get_ports clk_48mhz]  ;# 48 MHz USB
create_clock -name clk_core -period  5.000 [get_pins u_pll/clk_out] ;# 200 MHz core

# Clock groups (async crossing)
set_clock_groups -asynchronous \
    -group {clk_usb} \
    -group {clk_core}

# Input delays (USB PHY)
set_input_delay  -clock clk_usb 5.0 [get_ports {usb_dp_in usb_dn_in}]
set_input_delay  -clock clk_usb 5.0 [get_ports {cc_pin[*]}]

# Output delays (USB PHY)
set_output_delay -clock clk_usb 5.0 [get_ports {usb_dp_out usb_dn_out usb_oe}]
set_output_delay -clock clk_usb 2.0 [get_ports {led_*}]

# Power constraints
set_max_dynamic_power 2500 mW  ;# 5V @ 500mA = 2.5W total
set_max_leakage_power  100 mW

# Area constraint (USB-C dongle PCB: ~15mm × 30mm)
# Die area target: 5mm × 5mm = 25mm²

# False paths
set_false_path -from [get_ports rst_n]
set_false_path -to   [get_ports {led_*}]
