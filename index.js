require('dotenv').config();
const axios = require("axios"); 
const cheerio = require("cheerio");
const mongoose = require('mongoose');
const randomUseragent = require('random-useragent');
const Tvshow = require("./model/tvshows");
const Manual_Entry = require('./model/manual_entries');
const _headers = require ('./_headers');

const authority = process.env.AUTHORITY;
const referer = process.env.REFERER
const domain = process.env.DOMAIN;
const url = process.env.URL;
const DB = process.env.MONGODB;

const backup = [];

async function headers() {
    const config = _headers.config_0;
    config.headers['authority'] = authority;
    config.headers['referer'] = referer;
    return config;
};

async function paginationArr() {
    try {
        const config = await headers();
        const useragent = randomUseragent.getRandom(function (ua) {
            return ua.browserName === 'Chrome';});
        config.headers['user-agent'] = useragent;
        const pageHTML = await axios.get(url, config);
        const $ = cheerio.load(pageHTML.data);
        const last = $("#main-wrapper > div > section > div:nth-child(5) > nav > ul > li:nth-child(5) > a");
        const last_page = $(last).attr("href");
        const pages_count = last_page.substring(last_page.lastIndexOf('=') + 1);
        const page_count = parseInt(pages_count);
        const pages = [];
        for (let index = 1; index <= page_count; index = index + 1) {
            const page_url = `${url}` + index;
            pages.push(page_url);
        }
        console.log("PAGINATION DONE");
        console.log("GETTING PAGE CHUNK>>>>>>");
        return pages;
    }
    catch (error) {
        console.log(error);
    }
};

async function chunkify(a, n, balanced) {
    
    if (n < 2)
        return [a];

    var len = a.length,
            out = [],
            i = 0,
            size;

    if (len % n === 0) {
        size = Math.floor(len / n);
        while (i < len) {
            out.push(a.slice(i, i += size));
        }
    }

    else if (balanced) {
        while (i < len) {
            size = Math.ceil((len - i) / n--);
            out.push(a.slice(i, i += size));
        }
    }

    else {

        n--;
        size = Math.floor(len / n);
        if (len % size === 0)
            size--;
        while (i < size * n) {
            out.push(a.slice(i, i += size));
        }
        out.push(a.slice(size * n));

    }

    return out;
};

async function pagination_chunk(chunks, n) {
    const chunk = chunks[n];
    // const sliced = chunk.slice(0, 1);
    console.log("DONE");
    console.log("PROCESSING CARDS LINK>>>>>>>>");
    return chunk;
};

async function cards_link(paginationArray) {
    try {
        const pages = [];
        for(i = 0; i < paginationArray.length; i++) {
            const config = await headers();
            const useragent = randomUseragent.getRandom(function (ua) {
                return ua.browserName === 'Chrome';});
            config.headers['user-agent'] = useragent;
            const pageHTML = await axios.get(paginationArray[i], config);
            const $ = cheerio.load(pageHTML.data);
            $(".flw-item").map( (i, element) => {
                const film = $(element).find(".film-poster");
                const id = $(film).find("a").attr("href");
                pages.push(id);
                }).get();
        }
        console.log(pages.length+" "+"IDS TO PROCESS");
        return pages;
    }
    catch (error) {
        console.log(error);
    }
};

async function VerifyIfCardsinDB(cardsArray, n) {
    try {
        const cards = [];
        const clean = (cardsArray || []).map(async card => {
            const cardsFromDb = await Tvshow.findOne({ stream_id: card.substring(n) });
            if (!cardsFromDb) {
                const link = `${domain}` + `${card}`;
                cards.push(link)
            }
        });
        await Promise.all(clean);
        console.log(cards.length+" "+"IDS TO ADD TO DB");
        console.log("GETTING IDS>>>>>>>>")
        return cards
    }
    catch (error) {
        console.log(error);
    }
};

async function id(verifiedCards) {
    try {
        const timer = ms => new Promise(res => setTimeout(res, ms))
        const cards = [];
        for(i = 0; i < verifiedCards.length; i++) {
            const config = await headers();
            const useragent = randomUseragent.getRandom(function (ua) {
                return ua.browserName === 'Chrome';});
            config.headers['user-agent'] = useragent;
            const pageHTML = await axios.get(verifiedCards[i], config);
            if (!pageHTML.data.includes("container-404 text-center") && !pageHTML.data.includes("Moved Permanently. Redirecting to")) {
                const $ = cheerio.load(pageHTML.data);
                const tmdb_id = $(".watching_player-area").attr("data-tmdb-id");
                const url_path = $("head > meta:nth-child(11)");
                const url = $(url_path).attr("content");
                const stream_id = url.substring(url.lastIndexOf('/') + 1);
                const card = { tmdb_id, stream_id };
                cards.push(card);
                await timer(700);
                // console.log(card);
            }
            else {
                const link = { Link: verifiedCards[i] }
                backup.push(link);
            }
        }
        console.log("SCRAPING COMPLETED");
        // console.log(cards);
        return cards;
    }
    catch (error) {
        console.log(error);
    }
};

async function insertCardsInMongoDb(ids_full) {
    try {
        const cards = [];
        const promises = (ids_full || []).map(async card => {
        const cardsFromDb = await Tvshow.findOne({ stream_id: card.stream_id });
        if (!cardsFromDb) {
            const newCard = new Tvshow(card);
            cards.push(card);
            // console.log(card);
            return newCard.save();
        }
        });
        await Promise.all(promises);
        console.log(cards.length+" "+"ID ADDED TO DB");
    }
    catch (error) {
        console.log(error);
    }
};

async function insertLinkWithError() {
    try {
        const cards = [];
        const promises = (backup || []).map(async card => {
        const cardsFromDb = await Manual_Entry.findOne({ Link: card.Link });
        if (!cardsFromDb) {
            const newCard = new Manual_Entry(card);
            cards.push(card);
            // console.log(card);
            return newCard.save();
        }
        });
        await Promise.all(promises);
        console.log(cards.length+" "+"ID SAVE TO ADD MANUALLY");
    }
    catch (error) {
        console.log(error);
    }
};

async function main() {
    try {
        const date = new Date();
        const time = date.toUTCString();
        console.log(time);
        await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true }, function(){
            console.log("CONNECTED TO MONGODB");
        });
        const pagination = await paginationArr();
        const chunks = await chunkify(pagination, 4, true);//(pagination, NumberofArray, balanced)
        const paginationArray = await pagination_chunk(chunks, 0);//CHUNK NUMBER 0 = 1
        const cardsArray = await cards_link(paginationArray);
        const verifiedCards = await VerifyIfCardsinDB(cardsArray, 4);//IF MOVIE=>(CardsArray, 7) IF TV=>(CardsArray, 4)
        const ids_full = await id(verifiedCards);
        await insertCardsInMongoDb(ids_full);
        await insertLinkWithError();
        mongoose.disconnect(function(){
            console.log("SUCCESSFULLY DISCONNECTED FROM MONGODB!");
        });
    }
    catch (error) {
        console.log(error);
    }
};

main();