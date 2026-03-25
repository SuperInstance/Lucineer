/**
 * GDSII Stream Format Parser
 *
 * Reads binary GDSII files and extracts polygon geometry per layer.
 * Supports: BOUNDARY, PATH, SREF, AREF record types.
 *
 * Reference: Calma GDS II Stream Format Manual
 */

// GDSII record types
const RECORD_TYPES = {
  HEADER: 0x0002,
  BGNLIB: 0x0102,
  LIBNAME: 0x0206,
  UNITS: 0x0305,
  ENDLIB: 0x0400,
  BGNSTR: 0x0502,
  STRNAME: 0x0606,
  ENDSTR: 0x0700,
  BOUNDARY: 0x0800,
  PATH: 0x0900,
  SREF: 0x0a00,
  AREF: 0x0b00,
  TEXT: 0x0c00,
  LAYER: 0x0d02,
  DATATYPE: 0x0e02,
  WIDTH: 0x0f03,
  XY: 0x1003,
  ENDEL: 0x1100,
  SNAME: 0x1206,
  COLROW: 0x1302,
  STRANS: 0x1a01,
  MAG: 0x1b05,
  ANGLE: 0x1c05,
  PATHTYPE: 0x2102,
} as const;

// MLS layer mapping
const MLS_LAYER_NAMES: Record<number, string> = {
  0: "DIFF",
  1: "NWELL",
  2: "POLY",
  10: "M1",
  11: "VIA1",
  20: "M2",
  21: "VIA2",
  30: "M3",
  31: "VIA3",
  40: "M4",    // Weight layer
  41: "VIA4",
  50: "M5",
  51: "VIA5",
  60: "M6",    // Weight layer
};

export interface GDSIICell {
  name: string;
  boundaries: GDSIIBoundary[];
  paths: GDSIIPathElement[];
  references: GDSIISRef[];
}

export interface GDSIIBoundary {
  layer: number;
  datatype: number;
  points: Array<{ x: number; y: number }>;
}

export interface GDSIIPathElement {
  layer: number;
  datatype: number;
  width: number;
  pathtype: number;
  points: Array<{ x: number; y: number }>;
}

export interface GDSIISRef {
  structName: string;
  origin: { x: number; y: number };
  angle: number;
  magnification: number;
  reflected: boolean;
}

export interface GDSIILibrary {
  name: string;
  units: { userUnit: number; dbUnit: number };
  cells: Map<string, GDSIICell>;
}

/**
 * Parse a GDSII binary buffer into structured data.
 */
export function parseGDSII(buffer: ArrayBuffer): GDSIILibrary {
  const view = new DataView(buffer);
  let offset = 0;

  const library: GDSIILibrary = {
    name: "",
    units: { userUnit: 1e-6, dbUnit: 1e-9 },
    cells: new Map(),
  };

  let currentCell: GDSIICell | null = null;
  let currentLayer = 0;
  let currentDatatype = 0;
  let currentWidth = 0;
  let currentPathtype = 0;
  let elementType: "boundary" | "path" | "sref" | "aref" | "text" | null = null;
  let currentSName = "";

  while (offset < buffer.byteLength) {
    // Read record header
    const recordLength = view.getUint16(offset);
    if (recordLength < 4) break;

    const recordType = view.getUint16(offset + 2);
    const dataOffset = offset + 4;
    const dataLength = recordLength - 4;

    switch (recordType) {
      case RECORD_TYPES.LIBNAME:
        library.name = readString(view, dataOffset, dataLength);
        break;

      case RECORD_TYPES.UNITS:
        if (dataLength >= 16) {
          library.units.userUnit = readFloat64(view, dataOffset);
          library.units.dbUnit = readFloat64(view, dataOffset + 8);
        }
        break;

      case RECORD_TYPES.BGNSTR:
        currentCell = {
          name: "",
          boundaries: [],
          paths: [],
          references: [],
        };
        break;

      case RECORD_TYPES.STRNAME:
        if (currentCell) {
          currentCell.name = readString(view, dataOffset, dataLength);
        }
        break;

      case RECORD_TYPES.ENDSTR:
        if (currentCell) {
          library.cells.set(currentCell.name, currentCell);
          currentCell = null;
        }
        break;

      case RECORD_TYPES.BOUNDARY:
        elementType = "boundary";
        currentLayer = 0;
        currentDatatype = 0;
        break;

      case RECORD_TYPES.PATH:
        elementType = "path";
        currentLayer = 0;
        currentDatatype = 0;
        currentWidth = 0;
        currentPathtype = 0;
        break;

      case RECORD_TYPES.SREF:
        elementType = "sref";
        currentSName = "";
        break;

      case RECORD_TYPES.LAYER:
        if (dataLength >= 2) {
          currentLayer = view.getInt16(dataOffset);
        }
        break;

      case RECORD_TYPES.DATATYPE:
        if (dataLength >= 2) {
          currentDatatype = view.getInt16(dataOffset);
        }
        break;

      case RECORD_TYPES.WIDTH:
        if (dataLength >= 4) {
          currentWidth = view.getInt32(dataOffset);
        }
        break;

      case RECORD_TYPES.PATHTYPE:
        if (dataLength >= 2) {
          currentPathtype = view.getInt16(dataOffset);
        }
        break;

      case RECORD_TYPES.SNAME:
        currentSName = readString(view, dataOffset, dataLength);
        break;

      case RECORD_TYPES.XY: {
        const points = readXY(view, dataOffset, dataLength);

        if (currentCell && elementType === "boundary") {
          currentCell.boundaries.push({
            layer: currentLayer,
            datatype: currentDatatype,
            points,
          });
        } else if (currentCell && elementType === "path") {
          currentCell.paths.push({
            layer: currentLayer,
            datatype: currentDatatype,
            width: currentWidth,
            pathtype: currentPathtype,
            points,
          });
        } else if (currentCell && elementType === "sref" && points.length > 0) {
          currentCell.references.push({
            structName: currentSName,
            origin: points[0],
            angle: 0,
            magnification: 1,
            reflected: false,
          });
        }
        break;
      }

      case RECORD_TYPES.ENDEL:
        elementType = null;
        break;
    }

    offset += recordLength;
  }

  return library;
}

/**
 * Get human-readable layer name.
 */
export function getLayerName(layerNum: number): string {
  return MLS_LAYER_NAMES[layerNum] ?? `L${layerNum}`;
}

/**
 * Check if a layer carries mask-lock weights.
 */
export function isWeightLayer(layerNum: number): boolean {
  return layerNum === 40 || layerNum === 60; // M4, M6
}

// ---------- Binary Helpers ----------

function readString(view: DataView, offset: number, length: number): string {
  let str = "";
  for (let i = 0; i < length; i++) {
    const ch = view.getUint8(offset + i);
    if (ch === 0) break;
    str += String.fromCharCode(ch);
  }
  return str;
}

function readFloat64(view: DataView, offset: number): number {
  // GDSII uses 8-byte real (excess-64, not IEEE 754)
  const byte0 = view.getUint8(offset);
  const sign = (byte0 & 0x80) !== 0 ? -1 : 1;
  const exponent = (byte0 & 0x7f) - 64;

  let mantissa = 0;
  for (let i = 1; i < 8; i++) {
    mantissa = mantissa * 256 + view.getUint8(offset + i);
  }
  mantissa /= Math.pow(2, 56);

  return sign * mantissa * Math.pow(16, exponent);
}

function readXY(
  view: DataView,
  offset: number,
  length: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 7 < length; i += 8) {
    const x = view.getInt32(offset + i);
    const y = view.getInt32(offset + i + 4);
    points.push({ x, y });
  }
  return points;
}
