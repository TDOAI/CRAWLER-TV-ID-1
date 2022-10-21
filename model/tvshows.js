const mongoose = require("mongoose");

const TvshowsSchema = new mongoose.Schema({
    tmdb_id: String,
    stream_id: { type: String, index: true }
},{versionKey: false})

const Tvshow = mongoose.model("Tvshow", TvshowsSchema);

module.exports = Tvshow;