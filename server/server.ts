import express from "express";
import path from "path";
import { search } from "./search";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";
import { writeUpdate, resetText, ALL_TEXT_PROMISE } from "./preprocessing";
import * as dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT ?? 3000;
let resettingText = false; // true whenever server is fetching/writing data to disk

const app = express();

/**
 * If server is currently in the process of resetting text, sends an HTTP
 * response telling client to hang tight and returns true. Else returns false.
 *
 * @param res response object to send to if text is currently being reset
 * @returns boolean indicating whether server is busy
 */
const isResetting = (res: Response) => {
    if (resettingText) {
        res.status(StatusCodes.IM_A_TEAPOT)
            .type("html")
            .send(
                "<p>Hang tight: server currently fetching and updating text data</p>"
            );
    }
    return resettingText;
};

app.get("/", (req, res) => {
    if (isResetting(res)) return;
    res.status(StatusCodes.OK).sendFile(
        path.resolve(__dirname, "..", "index.html")
    );
});

type SearchRequest = {
    query: string;
};
type AdminRequest = {
    password: string;
    command: string;
};

async function searchHandler(
    req: Request<{}, {}, {}, SearchRequest>,
    res: Response
) {
    if (isResetting(res)) return;
    const query = req.query.query;
    try {
        const allData = await search(query.split(","));
        const data = allData.filter((ch) => ch.score > 0);
        res.status(StatusCodes.OK).send(data);
    } catch (err) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send();
    }
}

async function handleAdminTasks(
    req: Request<{}, {}, {}, AdminRequest>,
    res: Response
) {
    if (isResetting(res)) return;
    try {
        if (req.query.password === process.env.ADMIN_KEY) {
            console.log("admin access granted");
            switch (req.query.command) {
                case "reset":
                    resettingText = true;
                    resetText(true);
                    ALL_TEXT_PROMISE.then(() => (resettingText = false));
                    break;
                case "update":
                    resettingText = true;
                    writeUpdate().then(() => (resettingText = false));
                    break;
                default:
                    res.status(StatusCodes.BAD_REQUEST).send();
                    return;
            }
            res.status(StatusCodes.OK).send();
        } else res.status(StatusCodes.UNAUTHORIZED).send();
    } catch (err) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(String(err));
    }
}

/**
 * API endpoint: request must have `query` field consisting of
 * comma-separated list of search keywords. Server responds with an array
 * of objects of the form {name: string, url: string, score: number, excerpts: string[]},
 * one for each chapter with positive score (i.e. at least one occurrence of some
 * keyword in that chapter), sorted chronologically (earliest to latest)
 *
 * If the server errors during the computation, responds with status code INTERNAL_SERVER ERROR
 */
app.get("/search", searchHandler);

/**
 * API endpoint: request must have `password` and `command` fields.
 * If the password does not match the environment variable `ADMIN_KEY`, then
 * responds with UNAUTHORIZED status code. Otherwise, switch-cases on `command`:
 *      - If `"reset"`, then initiates refetching and rewriting text data to disk
 *      - If `"update"`, then intitates fetching and writing new text chapters to disk
 * If `command` is none of these, responds with a BAD_REQUEST status code.
 */
app.get("/admin", handleAdminTasks);

const staticPath = path.resolve(__dirname, "..");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
