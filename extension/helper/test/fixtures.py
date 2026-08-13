from __future__ import annotations


# Real lab advertisements captured from the CBS250, with the LLDP management TLV
# removed to preserve the previously observed no-management LLDP case.
LAB_LLDP_HEX = (
    "0180c200000e8c1e8072512788cc"
    "0207048c1e80725126"
    "0407038c1e80725127"
    "06020078"
    "fe070012bb01003704"
    "fe0900120f01036c01001e"
    "fe0e00120f0500110011001100110011"
    "0a0b7365616e2d737769746368"
    "0e0400040004"
    "fe060080c2010001"
    "0000"
)

LAB_CDP_HEX = (
    "01000ccccccc8c1e8072512700b2aaaa0300000c200002b4e7f7"
    "00010010386331653830373235313236"
    "0002002d000000020101cc0004c0a801020208aaaa0300000086dd0010fe800000000000008e1e80fffe725126"
    "00030007676931"
    "0004000800000029"
    "0005000b332e352e332e32"
    "0006002b436973636f204342533235302d38542d4420285049443a4342533235302d38542d44292d565344"
    "000a00060001000b000501001200050000130005000014000f7365616e2d737769746368"
)

LAB_LLDP_FRAME = bytes.fromhex(LAB_LLDP_HEX)
LAB_CDP_FRAME = bytes.fromhex(LAB_CDP_HEX)


def lldp_tlv(tlv_type: int, value: bytes) -> bytes:
    return ((tlv_type << 9) | len(value)).to_bytes(2, "big") + value


def lldp_frame(*tlvs: bytes) -> bytes:
    return bytes.fromhex("0180c200000e00112233445588cc") + b"".join(tlvs) + b"\x00\x00"


def cdp_tlv(tlv_type: int, value: bytes) -> bytes:
    return tlv_type.to_bytes(2, "big") + (len(value) + 4).to_bytes(2, "big") + value


def cdp_frame(*tlvs: bytes) -> bytes:
    payload = bytes.fromhex("aaaa0300000c200002000000") + b"".join(tlvs)
    return bytes.fromhex("01000ccccccc001122334455") + len(payload).to_bytes(2, "big") + payload
