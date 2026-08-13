const IPV4_ADDRESS_SPACE_SIZE = 2 ** 32;

export interface SubnetAnalysis {
  input: string;
  address: string;
  prefixLength: number;
  subnetMask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastBoundary: string;
  broadcastAddress: string | null;
  broadcastDescription: string | null;
  firstUsable: string;
  lastUsable: string;
  totalAddresses: number;
  usableHosts: number;
}

export class SubnetValidationError extends Error {
  public constructor(input: string) {
    super(`Invalid IPv4 address or CIDR: ${input}`);
    this.name = "SubnetValidationError";
  }
}

export function analyzeSubnet(rawInput: string): SubnetAnalysis {
  const input = rawInput.trim();
  const parsed = parseInput(input);
  const addressValue = ipv4ToInteger(parsed.octets);
  const totalAddresses = 2 ** (32 - parsed.prefixLength);
  const networkValue = Math.floor(addressValue / totalAddresses) * totalAddresses;
  const broadcastValue = networkValue + totalAddresses - 1;
  const subnetMaskValue = IPV4_ADDRESS_SPACE_SIZE - totalAddresses;
  const wildcardMaskValue = totalAddresses - 1;

  const address = integerToIpv4(addressValue);
  const networkAddress = integerToIpv4(networkValue);
  const broadcastBoundary = integerToIpv4(broadcastValue);

  if (parsed.prefixLength === 32) {
    return {
      input,
      address,
      prefixLength: parsed.prefixLength,
      subnetMask: integerToIpv4(subnetMaskValue),
      wildcardMask: integerToIpv4(wildcardMaskValue),
      networkAddress,
      broadcastBoundary,
      broadcastAddress: null,
      broadcastDescription: "N/A (/32 host route)",
      firstUsable: address,
      lastUsable: address,
      totalAddresses,
      usableHosts: 1,
    };
  }

  if (parsed.prefixLength === 31) {
    return {
      input,
      address,
      prefixLength: parsed.prefixLength,
      subnetMask: integerToIpv4(subnetMaskValue),
      wildcardMask: integerToIpv4(wildcardMaskValue),
      networkAddress,
      broadcastBoundary,
      broadcastAddress: null,
      broadcastDescription: "N/A (/31 point-to-point)",
      firstUsable: networkAddress,
      lastUsable: broadcastBoundary,
      totalAddresses,
      usableHosts: 2,
    };
  }

  return {
    input,
    address,
    prefixLength: parsed.prefixLength,
    subnetMask: integerToIpv4(subnetMaskValue),
    wildcardMask: integerToIpv4(wildcardMaskValue),
    networkAddress,
    broadcastBoundary,
    broadcastAddress: broadcastBoundary,
    broadcastDescription: null,
    firstUsable: integerToIpv4(networkValue + 1),
    lastUsable: integerToIpv4(broadcastValue - 1),
    totalAddresses,
    usableHosts: totalAddresses - 2,
  };
}

interface ParsedInput {
  octets: readonly [number, number, number, number];
  prefixLength: number;
}

function parseInput(input: string): ParsedInput {
  const parts = input.split("/");
  if (input.length === 0 || parts.length > 2) {
    throw new SubnetValidationError(input);
  }

  const addressPart = parts[0];
  const octetParts = addressPart.split(".");
  if (octetParts.length !== 4) {
    throw new SubnetValidationError(input);
  }

  const octets: readonly [number, number, number, number] = [
    parseOctet(octetParts[0], input),
    parseOctet(octetParts[1], input),
    parseOctet(octetParts[2], input),
    parseOctet(octetParts[3], input),
  ];

  const prefixPart = parts[1];
  let prefixLength = 32;
  if (prefixPart !== undefined) {
    if (!/^(0|[1-9]\d?)$/.test(prefixPart)) {
      throw new SubnetValidationError(input);
    }

    prefixLength = Number(prefixPart);
    if (prefixLength > 32) {
      throw new SubnetValidationError(input);
    }
  }

  return {
    octets,
    prefixLength,
  };
}

function parseOctet(octet: string, input: string): number {
  if (!/^(0|[1-9]\d{0,2})$/.test(octet)) {
    throw new SubnetValidationError(input);
  }

  const value = Number(octet);
  if (value > 255) {
    throw new SubnetValidationError(input);
  }

  return value;
}

function ipv4ToInteger(octets: readonly [number, number, number, number]): number {
  return octets.reduce((value, octet) => value * 256 + octet, 0);
}

function integerToIpv4(value: number): string {
  const first = Math.floor(value / 256 ** 3);
  const remainderAfterFirst = value % 256 ** 3;
  const second = Math.floor(remainderAfterFirst / 256 ** 2);
  const remainderAfterSecond = remainderAfterFirst % 256 ** 2;
  const third = Math.floor(remainderAfterSecond / 256);
  const fourth = remainderAfterSecond % 256;

  return `${first}.${second}.${third}.${fourth}`;
}
