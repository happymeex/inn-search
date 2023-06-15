import express from "express";
import path from "path";
import { search } from "./search";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";
import { chapterData } from "./search";
import * as dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT ?? 3000;

const app = express();

app.get("/", (req, res) => {
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
    index?: string;
};

async function searchHandler(
    req: Request<{}, {}, {}, SearchRequest>,
    res: Response
) {
    const query = req.query.query;
    try {
        const allData = await search(query);
        if (allData === undefined) {
            res.status(StatusCodes.BAD_REQUEST).send("query is too large!");
            return;
        }
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
    try {
        if (req.query.password === process.env.ADMIN_KEY) {
            console.log(`admin issued ${req.query.command} command, ${Date()}`);
            switch (req.query.command) {
                case "reset":
                    await chapterData.reset();
                    return;
                case "update":
                    await chapterData.update();
                    break;
                case "patch":
                    const indexString = req.query.index;
                    if (indexString === undefined) {
                        res.status(StatusCodes.BAD_REQUEST).send(
                            "missing chapter index"
                        );
                        return;
                    }
                    const index = parseInt(indexString);
                    await chapterData.writeChapter(index);
                    break;
                case "ping":
                    break;
                default:
                    res.status(StatusCodes.BAD_REQUEST).send();
                    return;
            }
            res.status(StatusCodes.OK).send(`${req.query.command} OK`);
        } else res.status(StatusCodes.UNAUTHORIZED).send();
    } catch (err) {
        console.log(String(err));
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(String(err));
    }
}

/**
 * API endpoint: request must have `query` field consisting of
 * comma-separated list of search keywords. Server responds with an array
 * of objects of the form {name: string, url: string, score: number, excerpts: string[]},
 * one for each chapter with positive score (i.e. at least one occurrence of some
 * keyword in that chapter), sorted chronologically (earliest to latest). The URL is absolute.
 *
 * If the search query is too long (more than 200 characters including separating commas),
 * responds with status code BAD_REQUEST.
 * If the server otherwise errors during the computation, responds with status code INTERNAL_SERVER ERROR
 */
app.get("/search", searchHandler);

/**
 * API endpoint: request must have `password` and `command` fields.
 * If the password does not match the environment variable `ADMIN_KEY`, then
 * responds with UNAUTHORIZED status code. Otherwise, switch-cases on `command`:
 *      - If `reset`, then initiates refetching and rewriting text data to disk
 *      - If `update`, then intitates fetching and writing new text chapters to disk
 *        and as well as checking whether all existing chapter names and urls have
 *        counterparts in the newly fetched table of contents. If a discrepancy
 *        is observed in the existing chapters, response with INTERNAL_SERVER_ERROR status
 *        and sends the old and new name and url of the changed chapter.
 *      - if `patch`, then expects a query parameter `index` that should a be a nonnegative
 *        integer. Fetches and writes the `index`th chapter.
 *      - if `ping`, does nothing (apart from printing to the command to console).
 * If a fetch error occurs at any point, responds with INTERNAL_SERVER_ERROR status code.
 * If `command` is neither `update` nor `reset`, responds with a BAD_REQUEST status code.
 */
app.get("/admin", handleAdminTasks);

const staticPath = path.resolve(__dirname, "..");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
