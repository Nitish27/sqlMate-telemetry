const textEncoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const hashIpAddress = async (ipAddress?: string | null): Promise<string | null> => {
  if (!ipAddress) {
    return null;
  }

  const normalizedIp = ipAddress.trim();

  if (!normalizedIp) {
    return null;
  }

  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(normalizedIp));

  return bytesToHex(new Uint8Array(digest));
};
