import chalk from "chalk";
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

/**
 * Logs a pretty box with a title and content lines
 * @param title The title of the box
 * @param content Array of content lines to display
 * @param color The chalk color function to use for borders
 */
export const logBox = (
    title: string,
    content: string[],
    color: typeof chalk.cyan = chalk.cyan
) => {
    const width = 70;
    const topBorder = color("╭" + "─".repeat(width - 2) + "╮");
    const bottomBorder = color("╰" + "─".repeat(width - 2) + "╯");

    // Calculate title width properly (accounting for ANSI codes and emojis)
    const titleWidth = stringWidth(stripAnsi(title));
    const titlePadding = Math.max(0, width - titleWidth - 4);
    const titleLine =
        color("│ ") + title + " ".repeat(titlePadding) + color(" │");

    console.log(topBorder);
    console.log(titleLine);
    console.log(color("├" + "─".repeat(width - 2) + "┤"));

    content.forEach((line) => {
        // Use string-width to properly calculate visual width
        const visualWidth = stringWidth(stripAnsi(line));
        const padding = Math.max(0, width - visualWidth - 4);
        console.log(color("│ ") + line + " ".repeat(padding) + color(" │"));
    });

    console.log(bottomBorder);
};

/**
 * Formats JSON with gray coloring
 * @param obj The object to format
 * @param indent The number of spaces to indent
 * @returns Formatted JSON string with gray coloring
 */
export const formatJSON = (obj: any, indent = 2): string => {
    return JSON.stringify(obj, null, indent)
        .split("\n")
        .map((line) => chalk.gray(line))
        .join("\n");
};

/**
 * Logs an incoming MCP client message
 */
export const logClientMessage = (
    sessionId: string | undefined,
    messageBody: any
) => {
    const messageType = messageBody.method || "unknown";
    const isNewSession = !sessionId;

    const title = isNewSession
        ? chalk.bold.white("📨 Client → Server ") + chalk.yellow("(NEW)")
        : chalk.bold.white("📨 Client → Server");

    logBox(
        title,
        [
            `${chalk.blue("Session:")} ${
                sessionId
                    ? chalk.green(sessionId.substring(0, 20) + "...")
                    : chalk.yellow("(initializing)")
            }`,
            `${chalk.blue("Method:")} ${chalk.magenta(messageType)}`,
            `${chalk.blue("Payload:")}`,
            ...formatJSON(messageBody)
                .split("\n")
                .map((line) => `  ${line}`),
        ],
        chalk.blue
    );
};

/**
 * Logs an outgoing MCP server message
 */
export const logServerMessage = (
    sessionId: string | undefined,
    messageBody: any
) => {
    const messageType =
        messageBody.method ||
        (messageBody.result
            ? "result"
            : messageBody.error
            ? "error"
            : "unknown");

    logBox(
        chalk.bold.white("📤 Server → Client"),
        [
            `${chalk.blue("Session:")} ${
                sessionId
                    ? chalk.green(sessionId.substring(0, 20) + "...")
                    : chalk.yellow("(no session)")
            }`,
            `${chalk.blue("Type:")} ${chalk.cyan(messageType)}`,
            `${chalk.blue("Payload:")}`,
            ...formatJSON(messageBody)
                .split("\n")
                .map((line) => `  ${line}`),
        ],
        chalk.cyan
    );
};

/**
 * Logs session initialization
 */
export const logSessionInitialized = (
    sessionId: string,
    activeCount: number
) => {
    logBox(
        chalk.bold.white("✨ Session Initialized"),
        [
            `${chalk.blue("Session ID:")} ${chalk.green(sessionId)}`,
            `${chalk.blue("Active Sessions:")} ${chalk.cyan(
                activeCount.toString()
            )}`,
        ],
        chalk.green
    );
};

/**
 * Logs session closure
 */
export const logSessionClosed = (sessionId: string, remainingCount: number) => {
    logBox(
        chalk.bold.white("👋 Session Closed"),
        [
            `${chalk.blue("Session ID:")} ${chalk.red(sessionId)}`,
            `${chalk.blue("Remaining Sessions:")} ${chalk.cyan(
                remainingCount.toString()
            )}`,
        ],
        chalk.red
    );
};

/**
 * Logs tool invocation
 */
export const logToolInvocation = (toolName: string, action: string) => {
    logBox(
        chalk.bold.white("🛠️  Tool Invocation"),
        [
            `${chalk.blue("Tool:")} ${chalk.magenta(toolName)}`,
            `${chalk.blue("Action:")} ${chalk.gray(action)}`,
        ],
        chalk.magenta
    );
};

/**
 * Logs session request failure
 */
export const logSessionRequestFailed = (
    method: string,
    sessionId: string | undefined,
    activeCount: number
) => {
    const methodIcon = method === "GET" ? "📥" : "🗑️";

    logBox(
        chalk.bold.white(`${methodIcon} ${method} Request Failed`),
        [
            `${chalk.blue("Session:")} ${
                sessionId ? chalk.red(sessionId) : chalk.red("(missing)")
            }`,
            `${chalk.red("Error:")} Session not found`,
            `${chalk.blue("Active Sessions:")} ${chalk.cyan(
                activeCount.toString()
            )}`,
        ],
        chalk.red
    );
};

/**
 * Logs server startup
 */
export const logServerStarted = (port: string | number) => {
    console.log("\n");
    logBox(
        chalk.bold.white("🚀 MCP Server Started"),
        [
            `${chalk.blue("Port:")} ${chalk.green(port.toString())}`,
            `${chalk.blue("URL:")} ${chalk.cyan(`http://localhost:${port}`)}`,
            `${chalk.blue("Status:")} ${chalk.green(
                "Ready to accept connections"
            )}`,
        ],
        chalk.green
    );
    console.log("\n");
};
