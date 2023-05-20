# Search The Wandering Inn

This is a search website for ✨[The Wandering Inn]("https://wanderinginn.com")✨,
a great fantasy LitRPG webnovel. It's got memorable characters, expansive worldbuilding, and a gripping story
full of magic and monsters. You should check it out!

I started developing this site while the webnovel's own
search function was broken. It has since been fixed, but I
figured I could improve the UI/UX so I built this site
anyways. Here are some features:

-   Search results with keyword-highlighted excerpts
-   Sorting search results by relevance or by chronology
-   A few Easter eggs...?

I am going to try to deploy this soon.

## Development

This repository contains the source code for both the web client and the server.
To develop locally: first clone and `npm install`. Then make a `.env`
file in the root directory containing a line `ADMIN_KEY=[password]`, where `[password]`
is a string of your choosing.
Run `npm start` to compile and start the server, and then open your browser and visit

```
https://localhost:3000/admin?password=[password]&command=reset
```

This prompts the server
to initiate the webscraping process to fetch and write all chapter data to disk.
This should take a few hours; the console will notify you when it is finished.
(It fetches in batches of 20 every 5 minutes to avoid a 429 response from
the TWI web server. You can adjust these parameters by playing with the constants in `server/preprocessing.ts`.)
Finally, visit `localhost:3000/` to view the website.

If you make changes to the client, run `npm run copy` before visiting the site again.

To update the data when a new chapter is released, run the server and then visit

```
https://localhost:3000/admin?password=[password]&command=update
```

to prompt the server to fetch and write
the new chapter.

Tested on Ubuntu.
