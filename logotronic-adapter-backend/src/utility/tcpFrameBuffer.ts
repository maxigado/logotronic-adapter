import logger from "./logger";

/**
 * TCP Frame Buffer utility for handling fragmented Logotronic protocol frames.
 * Buffers incoming TCP chunks and extracts complete frames based on the protocol structure:
 * - Header: 24 bytes (includes dataLength field at offset 20)
 * - Body: variable length (specified by dataLength)
 * - Footer: 20 bytes
 */
export class TCPFrameBuffer {
  private buffer: Buffer = Buffer.alloc(0);
  private readonly HEADER_SIZE = 24;
  private readonly FOOTER_SIZE = 20;
  private readonly MIN_FRAME_SIZE = this.HEADER_SIZE + this.FOOTER_SIZE;

  /**
   * Add incoming data chunk to the buffer
   * @param chunk Incoming TCP data chunk
   */
  public addChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    logger.debug(
      `TCP chunk added. Chunk size: ${chunk.length}, Total buffer size: ${this.buffer.length}`
    );
  }

  /**
   * Extract and return all complete frames from the buffer.
   * Incomplete data remains in the buffer for the next chunk.
   * @returns Array of complete frame buffers
   */
  public extractCompleteFrames(): Buffer[] {
    const frames: Buffer[] = [];

    while (this.buffer.length >= this.MIN_FRAME_SIZE) {
      // Check if we have enough data to read the header
      if (this.buffer.length < this.HEADER_SIZE) {
        logger.debug("Not enough data for header. Waiting for more chunks.");
        break;
      }

      // Read dataLength from header (offset 20, 4 bytes, big-endian)
      const dataLength = this.buffer.readUInt32BE(20);
      const expectedFrameSize =
        this.HEADER_SIZE + dataLength + this.FOOTER_SIZE;

      logger.debug(
        `Frame analysis - Data length: ${dataLength}, Expected frame size: ${expectedFrameSize}, Current buffer: ${this.buffer.length}`
      );

      // Validate dataLength to prevent buffer overflow from corrupted data
      const MAX_REASONABLE_LENGTH = 1024 * 1024 * 1024; // 1GB (for large preview responses)
      if (
        dataLength < 0 ||
        dataLength > MAX_REASONABLE_LENGTH ||
        isNaN(dataLength)
      ) {
        logger.error(
          `Invalid dataLength detected: ${dataLength}. Possible corrupted frame. Clearing buffer.`
        );
        this.buffer = Buffer.alloc(0);
        break;
      }

      // Check if we have the complete frame
      if (this.buffer.length >= expectedFrameSize) {
        // Extract the complete frame
        const frame = this.buffer.slice(0, expectedFrameSize);

        // Validate footer before adding to frames
        const footerOffset = this.HEADER_SIZE + dataLength;
        const footerDataLength = frame.readUInt32BE(footerOffset);

        if (footerDataLength !== dataLength) {
          logger.error(
            `Frame footer validation failed during extraction. Header dataLength: ${dataLength}, Footer dataLength: ${footerDataLength}. Frame appears corrupted. Clearing buffer.`
          );
          this.buffer = Buffer.alloc(0);
          break;
        }

        frames.push(frame);

        // Remove the processed frame from buffer
        this.buffer = this.buffer.slice(expectedFrameSize);

        logger.info(
          `Complete frame extracted. Frame size: ${expectedFrameSize}, Remaining buffer: ${this.buffer.length}`
        );
      } else {
        // Not enough data yet, wait for more chunks
        logger.debug(
          `Incomplete frame. Waiting for ${
            expectedFrameSize - this.buffer.length
          } more bytes.`
        );
        break;
      }
    }

    return frames;
  }

  /**
   * Get current buffer size
   * @returns Current buffer size in bytes
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear the buffer (useful for error recovery)
   */
  public clear(): void {
    const previousSize = this.buffer.length;
    this.buffer = Buffer.alloc(0);
    logger.warn(`Buffer cleared. Previous size: ${previousSize}`);
  }
}
