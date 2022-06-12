const PlurkClient = require("./plurk-client");
const PlurkContect = require('./PlurkContent');
const axios = require('axios').default;
const config = require("../config");
const fs = require('fs')

const ONE_SEC = 1 * 1000
const ONE_MIN = 60 * ONE_SEC

function initPlurkClient() {
  return new PlurkClient({
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
    token: config.token,
    tokenSecret: config.tokenSecret,
  });
}

const fetch_youtube = (date) => {
  const urls = config.urls.youtube
  const k = config.keys.yt
  const news = []

  const promises = urls.map(u => {
    const url = `https://youtube.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${u}&maxResults=10&key=${k}`
    return axios.get(url)
  })

  Promise.all(promises).then(response => {
    response.forEach(function (res) {
      res.data.items.forEach(it => {
        const publishedAt = new Date(it.snippet.publishedAt)
        const vid = it.contentDetails.upload.videoId
        
        if (vid) {
          news.push(new PlurkContect("YT 影片", `https://www.youtube.com/watch?v=${vid}`))
        }
      })
    })
    return news
  })
};

async function main() {
  const client = initPlurkClient();

  update_latest_timestamp()

  // setInterval(() => {
    const news = []
  
    const date = new Date(JSON.parse(fs.readFileSync('./tz.json', 'utf8')).timestamp)

    news.concat(fetch_youtube(date))
    console.log(news)

    // fetch_instagram(date)

    // fetch_twitter(date)

    update_latest_timestamp()
  // }, ONE_MIN);

  function fetch_instagram(date) {
    const news = request_instagram_info()
    pull_new_plurks(news)
  };

  function fetch_twitter(date) {
    const news = request_twitter_info(date)
    pull_new_plurks(news)
  };

  function update_latest_timestamp() {
    const date = new Date()
    const time = {"timestamp" : date.toString()}
    fs.writeFileSync("./tz.json", JSON.stringify(time))
  }
}
main().catch(console.error);