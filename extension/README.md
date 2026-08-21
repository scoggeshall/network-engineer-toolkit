# Network Engineer Toolkit

<p align="center">
  <img src="assets/pyscout.png" alt="Py Scout, the Network Engineer Toolkit logo" width="180">
</p>

Network Engineer Toolkit is a Visual Studio Code extension for common Windows
networking tasks. Analyze IPv4 subnets, resolve DNS names and addresses, identify
the connected switchport, and discover devices on an IPv4 network without
leaving VS Code.

> **Release availability:** The latest published VSIX, `v0.1.1`, includes
> Analyze IP/Subnet, DNS Lookup, and Discover Switchport through the Command
> Palette. The Activity Bar interface and Network Scanner described below are
> available on the current `main` branch but are not yet included in a published
> VSIX. Check [Releases](https://github.com/scoggeshall/network-engineer-toolkit/releases)
> for the next packaged version.

## Features

### Analyze IP/Subnet

Enter an IPv4 address with an optional CIDR prefix, such as
`10.150.76.1/24`. A bare IPv4 address is treated as a `/32` host route.

The result includes:

- Subnet and wildcard masks
- Network and broadcast addresses
- First and last usable addresses
- Total address and usable host counts

Results open in the **Network Engineer Toolkit** Output panel. You can also
select a valid IPv4 address or CIDR in the active editor before starting the
tool.

### DNS Lookup

Resolve a hostname to its IPv4 or IPv6 addresses, or perform a reverse lookup
from an IP address to a hostname. For example, enter `google.com` for a forward
lookup or `8.8.8.8` for a reverse lookup.

DNS results open in the **Network Engineer Toolkit** Output panel. A valid
hostname or address selected in the active editor can be used directly.

### Discover Switchport

Select the connected Windows Ethernet adapter, then listen for LLDP or CDP
advertisements from the network device. When advertised, the result can include:

- Switch name and port
- Management address
- Platform and capabilities
- Software information

This feature requires Python 3, Scapy, and Npcap. Discovery also depends on the
connected switch advertising LLDP or CDP; if no advertisement is received, the
Toolkit may not be able to identify the switchport.

### Network Scanner

Scan an IPv4 subnet in CIDR notation and view discovered devices in the
**Network Scanner** section of the sidebar. Each result can show:

- IP address
- Hostname, when available
- MAC address, when observable on the local network
- Discovery method, latency, and other available identity information

Scans are limited to 254 hosts. Results remain in the sidebar until you start
another scan or select **Clear Network Scan Results**. Not every device has a
resolvable hostname. MAC addresses are shown when they can be observed on the
local network; routed devices may not have a MAC address displayed.

Network Scanner requires Python 3, Scapy, and Npcap.

## Requirements

- Windows
- Visual Studio Code 1.85.0 or newer
- Windows PowerShell for DNS Lookup
- Python 3, Scapy, and Npcap for Discover Switchport and Network Scanner

Analyze IP/Subnet has no additional prerequisites.

## Install the extension

1. Open the [Network Engineer Toolkit Releases page](https://github.com/scoggeshall/network-engineer-toolkit/releases).
2. Download the latest `.vsix` file.
3. In Visual Studio Code, open **Extensions**.
4. Open the Extensions menu (**Views and More Actions**).
5. Select **Install from VSIX...**.
6. Select the downloaded Network Engineer Toolkit VSIX.
7. Reload Visual Studio Code if prompted.

## Set up Python, Scapy, and Npcap

Discover Switchport and Network Scanner need Python 3 with Scapy, plus the Npcap
packet capture driver for Windows.

1. Install Python 3.
2. Install Scapy for that Python installation:

   ```powershell
   py -3 -m pip install scapy
   ```

3. Install [Npcap](https://npcap.com/#download) for Windows.

The Toolkit normally tries the Python launcher (`py -3`) and then `python`. To
use a specific Python installation, open VS Code Settings, search for
**Network Engineer Toolkit: Python Path**, and enter the full path to its Python
executable.

## Use the extension

1. Open Visual Studio Code.
2. Select the **Network Engineer Toolkit** icon in the Activity Bar.
3. In **Tools**, select **Analyze IP/Subnet**, **DNS Lookup**, or
   **Discover Switchport**.
4. In **Network Scanner**, select **Scan Network** to start a scan and expand the
   results to view device details.

The same commands are available through the Command Palette: press
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and search for `Network Tools`.

## Troubleshooting

### Network Scanner or Discover Switchport cannot start

Confirm that Python 3, Scapy, and Npcap are installed. If you have multiple
Python installations, set **Network Engineer Toolkit: Python Path** to the
Python executable where Scapy is installed.

### Discover Switchport finds nothing

Select the Ethernet adapter connected to the switch and confirm that the link is
up. The connected network device must advertise LLDP or CDP for the Toolkit to
identify it.

### Network Scanner shows no hostname

Not every device publishes or has a resolvable hostname. The device can still
appear by IP address.

### A routed scan shows no MAC address

This is expected for devices outside the local Layer 2 network. A remote
device's MAC address is not normally visible across a router.

## Releases and support

- Download packaged versions from [Releases](https://github.com/scoggeshall/network-engineer-toolkit/releases).
- Report bugs or request help through [GitHub Issues](https://github.com/scoggeshall/network-engineer-toolkit/issues).
