import { createLogger, transports, format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const logsDirectory = path.join(__dirname, "..", "logs");

const transport = new DailyRotateFile({
  filename: path.join(logsDirectory, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "7d",
});

const logger = createLogger({
  format: format.combine(
    format.label({ label: "logotronic-adapter" }),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Specify your desired timestamp format
    format.printf(({ level, message, label, timestamp }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    })
  ),
  transports: [new transports.Console(), transport],
});

logger.add(
  new transports.File({
    filename: path.join(logsDirectory, "error.log"),
    level: "error",
  })
);

export default logger;
