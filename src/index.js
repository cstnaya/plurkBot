const PlurkClient = require("./plurk-client");
const PlurkContect = require('./PlurkContent');
const axios = require('axios').default;
const config = require("../config");
const fs = require('fs')

const FIRST = true
const ONE_SEC = 1 * 1000
const MIN = 2 * 60 * ONE_SEC

async function main() {
  const client = initPlurkClient();

  update_latest_timestamp(FIRST)

  setInterval(() => {  
    const date = new Date(JSON.parse(fs.readFileSync('./tz.json', 'utf8')).timestamp)

    const promises = fetch_request()

    Promise.all(promises).then(response => {
      const plurks = []

      response.forEach(res => {
        const type = get_type_from_url(res.config.url)
        const data = res.data
        
        if (type === 'youtube') {
          plurks.push(...deal_yt_messages(data, date)) 
        }  else if (type === 'twitter') {
          plurks.push(...deal_tw_messages(data, date))
        }  else if (type === 'instagram') {
          plurks.push(...deal_ig_messages(data, date))
        }
      })

      return plurks
    }).then(plurks => poll_plurks(plurks, client))

    update_latest_timestamp()
  }, MIN);

  function get_type_from_url(url) {
    if (url.indexOf('youtube') > -1) { return 'youtube' }
    else if (url.indexOf('instagram') > -1) { return 'instagram' }
    else if (url.indexOf('twitter') > -1) { return 'twitter' }
    return undefined
  }

  function fetch_request () {
    return [...fetch_youtube(), ...fetch_twitter(), ...fetch_instagram()]
  }

  function fetch_youtube() {
    const urls = config.urls.youtube
    const k = config.keys.yt
  
    return urls.map(u => 
      axios.get(`https://youtube.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${u}&maxResults=10&key=${k}`))
  }

  function deal_yt_messages(data, date) {
    const news = []

    const msg = config.messages.yt

    data.items.forEach(it => {
      const publishedAt = new Date(it.snippet.publishedAt)
      const vid = it.contentDetails.upload.videoId
      
      if (vid && publishedAt.getTime() > date.getTime()) {
        news.push(new PlurkContect(msg, `https://www.youtube.com/watch?v=${vid}`))
      }
    })

    return news
  }

  function fetch_instagram() {
    const urls = config.urls.instagram
  
    return urls.map(u => 
      axios.get(`https://www.instagram.com/graphql/query/?query_hash=472f257a40c653c64c666ce877d59d2b&variables={"id":"${u}","first":10}`))
  }

  function deal_ig_messages(data, date) {
    if (!data.data) return []

    const msg = config.messages.ig
    
    const news = []
    
    data.data.user.edge_owner_to_timeline_media.edges.forEach(it => {
      const shortcode = it.shortcode
      const timestamp = it.taken_at_timestamp.padEnd('13', '0')

      if (shortcode && timestamp > date.getTime()) {
        news.push(new PlurkContect(msg, `https://www.instagram.com/p/${shortcode}`))
      }
    })

    return news
  }

  function fetch_twitter() {
    const urls = config.urls.twitter
    const k = config.keys.tw
  
    return urls.map(u => 
      axios({
        method: "GET",
        url: `https://api.twitter.com/2/users/${u}/tweets?tweet.fields=created_at,id,text,referenced_tweets`,
        headers: {
          'Authorization': 'Bearer ' + k
        }
      })
    )
  }

  function deal_tw_messages(data, date) {
    const news = []

    const msg = config.messages.tw

    data.data.forEach(it => {
      const timestamp = new Date(it.created_at)
      const tid = it.id
      const ref = it.referenced_tweets
      
      if (tid && timestamp.getTime() > date.getTime() && !ref) {
        news.push(new PlurkContect(msg, `https://mobile.twitter.com/user/status/${tid}`))
      }
    })

    return news
  }

  function update_latest_timestamp(first = false) {
    if (first && JSON.parse(fs.readFileSync('./tz.json', 'utf8')).timestamp) { return ; }

    const date = new Date()
    const time = {"timestamp" : date.toString()}
    fs.writeFileSync("./tz.json", JSON.stringify(time))
  }

  function initPlurkClient() {
    return new PlurkClient({
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      token: config.token,
      tokenSecret: config.tokenSecret,
    });
  }

  async function poll_plurks(plurks, client) {
    const p = plurks[0]
    
    const plurk = await client.request("/APP/Timeline/plurkAdd", {
      qualifier: ":",
      content: `${p.text} \n ${p.url}`
    })

    plurks.slice(1).forEach(function (p) {
      client.request("/APP/Responses/responseAdd", {
        plurk_id: plurk.plurk_id,
        qualifier: ":",
        content: `${p.text} \n ${p.url}`,
      })
    })
  }
}
main().catch(console.error);