import { analyzeSubnet, SubnetValidationError } from "../subnet";

export const MAX_SCAN_HOSTS = 254;

export interface ScanTarget {
  cidr: string;
  hostCount: number;
}

export class ScannerValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScannerValidationError";
  }
}

export function normalizeScanSubnet(rawInput: string): ScanTarget {
  const input = rawInput.trim();
  if (input.split("/").length !== 2) {
    throw new ScannerValidationError("Enter an IPv4 subnet in CIDR notation, such as 192.168.1.0/24.");
  }

  try {
    const analysis = analyzeSubnet(input);
    if (analysis.usableHosts > MAX_SCAN_HOSTS) {
      throw new ScannerValidationError(
        `Network Scanner supports at most ${MAX_SCAN_HOSTS} hosts (/24 or smaller).`,
      );
    }
    return {
      cidr: `${analysis.networkAddress}/${analysis.prefixLength}`,
      hostCount: analysis.usableHosts,
    };
  } catch (error) {
    if (error instanceof ScannerValidationError) {
      throw error;
    }
    if (error instanceof SubnetValidationError) {
      throw new ScannerValidationError(error.message);
    }
    throw error;
  }
}
