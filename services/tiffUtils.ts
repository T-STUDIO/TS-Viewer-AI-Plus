

declare global {
  interface Window {
    UTIF: any;
  }
}

/**
 * Renders a TIFF file to a canvas element using UTIF.js
 */
export async function renderTiffToCanvas(file: Blob, canvas: HTMLCanvasElement) {
  if (!window.UTIF) {
    throw new Error("UTIF library not loaded");
  }

  const buffer = await file.arrayBuffer();
  const ifds = window.UTIF.decode(buffer);
  
  if (!ifds || ifds.length === 0) {
    throw new Error("Invalid TIFF file or no IFDs found");
  }

  // Decode the first page of the TIFF
  const page = ifds[0];
  window.UTIF.decodeImage(buffer, page);
  
  const rgba = window.UTIF.toRGBA8(page);
  
  if (!page.width || !page.height || page.width <= 0 || page.height <= 0) {
    throw new Error(`Invalid TIFF dimensions: ${page.width}x${page.height}`);
  }

  // Validate data length matches dimensions
  if (rgba.length !== page.width * page.height * 4) {
    throw new Error("TIFF data length does not match dimensions");
  }
  
  canvas.width = page.width;
  canvas.height = page.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  try {
    const imageData = new ImageData(new Uint8ClampedArray(rgba), page.width, page.height);
    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.error("Failed to create ImageData for TIFF", e);
    throw new Error("Failed to render TIFF data");
  }
}

/**
 * Basic TIFF Writer (Uncompressed RGB) that supports ImageDescription.
 * This ensures we can save WCS/Header info into the TIFF.
 */
export function writeTiff(
    imageData: ImageData, 
    description: string
): Blob {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data; // RGBA
    
    // Create Header (8 bytes) + IFD (count + entries + next) + Values
    // We use Little Endian (II)
    // Header: II (2) + 42 (2) + OffsetToFirstIFD (4)
    
    // Entries: 
    // 256 ImageWidth (SHORT)
    // 257 ImageHeight (SHORT)
    // 258 BitsPerSample (SHORT, count 3) -> Offset
    // 259 Compression (SHORT) = 1 (None)
    // 262 PhotometricInterpretation (SHORT) = 2 (RGB)
    // 270 ImageDescription (ASCII) -> Offset
    // 273 StripOffsets (LONG) -> Offset
    // 277 SamplesPerPixel (SHORT) = 3
    // 278 RowsPerStrip (LONG) = height
    // 279 StripByteCounts (LONG) = width * height * 3
    // 282 XResolution (RATIONAL) -> Offset
    // 283 YResolution (RATIONAL) -> Offset
    // 296 ResolutionUnit (SHORT) = 2 (Inch)
    
    const entriesCount = 13;
    const ifdSize = 2 + (entriesCount * 12) + 4;
    const headerSize = 8;
    
    // Calc Offsets
    // Order: Header -> IFD -> BitsPerSample Values -> Resolution Values -> Description String -> Image Data
    let offset = headerSize + ifdSize;
    
    const bitsPerSampleOffset = offset;
    offset += 6; // 3 * SHORT(2)
    
    const xResOffset = offset;
    offset += 8; // 2 * LONG(4)
    
    const yResOffset = offset;
    offset += 8; // 2 * LONG(4)
    
    const descBytes = new TextEncoder().encode(description + '\0');
    const descOffset = offset;
    offset += descBytes.length;
    // Pad to word boundary? Not strictly required for basic parsers, but good practice.
    if (offset % 2 !== 0) offset++;
    
    const stripOffset = offset;
    const imageByteCount = width * height * 3;
    const totalSize = offset + imageByteCount;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    // Helper
    const writeShort = (o: number, v: number) => view.setUint16(o, v, true);
    const writeLong = (o: number, v: number) => view.setUint32(o, v, true);
    
    // 1. Header
    view.setUint8(0, 0x49); // I
    view.setUint8(1, 0x49); // I
    writeShort(2, 42);
    writeLong(4, headerSize); // Offset to first IFD
    
    // 2. IFD
    let ifdOffset = headerSize;
    writeShort(ifdOffset, entriesCount);
    ifdOffset += 2;
    
    const writeEntry = (tag: number, type: number, count: number, valueOrOffset: number) => {
        writeShort(ifdOffset, tag);
        writeShort(ifdOffset + 2, type);
        writeLong(ifdOffset + 4, count);
        if (type === 3 && count === 1) {
             writeShort(ifdOffset + 8, valueOrOffset);
             writeShort(ifdOffset + 10, 0); // Padding
        } else if (type === 4 && count === 1) {
             writeLong(ifdOffset + 8, valueOrOffset);
        } else {
             writeLong(ifdOffset + 8, valueOrOffset);
        }
        ifdOffset += 12;
    };
    
    // Write Entries (Must be sorted by Tag ID)
    writeEntry(256, 4, 1, width); // ImageWidth (LONG)
    writeEntry(257, 4, 1, height); // ImageHeight (LONG)
    writeEntry(258, 3, 3, bitsPerSampleOffset); // BitsPerSample
    writeEntry(259, 3, 1, 1); // Compression (None)
    writeEntry(262, 3, 1, 2); // Photometric (RGB)
    writeEntry(270, 2, descBytes.length, descOffset); // ImageDescription
    writeEntry(273, 4, 1, stripOffset); // StripOffsets
    writeEntry(277, 3, 1, 3); // SamplesPerPixel
    writeEntry(278, 4, 1, height); // RowsPerStrip
    writeEntry(279, 4, 1, imageByteCount); // StripByteCounts
    writeEntry(282, 5, 1, xResOffset); // XResolution
    writeEntry(283, 5, 1, yResOffset); // YResolution
    writeEntry(296, 3, 1, 2); // ResolutionUnit (Inch)
    
    writeLong(ifdOffset, 0); // Next IFD (0)
    
    // 3. Values
    // BitsPerSample (8,8,8)
    writeShort(bitsPerSampleOffset, 8);
    writeShort(bitsPerSampleOffset + 2, 8);
    writeShort(bitsPerSampleOffset + 4, 8);
    
    // Resolution (72/1)
    writeLong(xResOffset, 72);
    writeLong(xResOffset + 4, 1);
    writeLong(yResOffset, 72);
    writeLong(yResOffset + 4, 1);
    
    // Description
    const descView = new Uint8Array(buffer, descOffset, descBytes.length);
    descView.set(descBytes);
    
    // 4. Image Data (RGB from RGBA)
    const imgStart = stripOffset;
    const imgView = new Uint8Array(buffer, imgStart, imageByteCount);
    let px = 0;
    for (let i = 0; i < data.length; i += 4) {
        imgView[px++] = data[i];     // R
        imgView[px++] = data[i + 1]; // G
        imgView[px++] = data[i + 2]; // B
        // Skip Alpha
    }
    
    return new Blob([buffer], { type: 'image/tiff' });
}
