## KV260 Pin Constraints (XDC)
## MLS BitNet 2B Prototype

# System clock (200 MHz differential)
set_property PACKAGE_PIN F11 [get_ports sys_clk_200mhz_p]
set_property PACKAGE_PIN E10 [get_ports sys_clk_200mhz_n]
set_property IOSTANDARD LVDS [get_ports sys_clk_200mhz_p]
set_property IOSTANDARD LVDS [get_ports sys_clk_200mhz_n]
create_clock -period 5.000 -name sys_clk [get_ports sys_clk_200mhz_p]

# LEDs (accent LEDs on KV260 carrier)
set_property PACKAGE_PIN F8  [get_ports {led[0]}]
set_property PACKAGE_PIN E8  [get_ports {led[1]}]
set_property PACKAGE_PIN G8  [get_ports {led[2]}]
set_property PACKAGE_PIN H8  [get_ports {led[3]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[*]}]

# AXI clock from PS
create_clock -period 10.000 -name axi_clk [get_ports axi_aclk]

# Timing constraints
set_max_delay -from [get_clocks sys_clk] -to [get_clocks axi_clk] 5.0
set_max_delay -from [get_clocks axi_clk] -to [get_clocks sys_clk] 5.0
