import express from "express";
import path from "path";
import { search } from "./search";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";
import { resetText } from "./preprocessing";

const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, "..", "index.html"));
});

type SearchRequest = {
    query: string;
};

async function searchHandler(
    req: Request<{}, {}, {}, SearchRequest>,
    res: Response
) {
    const query = req.query.query;
    try {
        const allData = await search(query.split(","));
        const data = allData.filter((ch) => ch.score > 0);
        res.status(StatusCodes.OK).send(data);
    } catch (err) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send();
    }
}

/**
 * API endpoint: request must have `query` field
 */
app.get("/search", searchHandler);

const staticPath = path.resolve(__dirname, "..");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    //resetText(true);
});
