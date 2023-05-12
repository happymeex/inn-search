import express from "express";
import path from "path";
import { allText } from "./webScrape";
import fs from "fs";
const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, "..", "index.html"));
});

const staticPath = path.resolve(__dirname, "dist");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

void allText(10, 60 * 10);
