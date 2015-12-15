var cheerio = require('cheerio');

module.exports = {

    re: [
        /^https?:\/\/(?:www\.)?youtube\.com\/(?:tv#\/)?watch\/?\?(?:[^&]+&)*v=([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/youtu.be\/([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/m\.youtube\.com\/#\/watch\?(?:[^&]+&)*v=([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/www\.youtube\.com\/v\/([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/www\.youtube\.com\/user\/[a-zA-Z0-9_-]+\/?\?v=([a-zA-Z0-9_-]+)/i,
        /^https?:\/\/www\.youtube-nocookie\.com\/v\/([a-zA-Z0-9_-]+)/i
    ],

    mixins: ["domain-icon"],

    provides: 'youtube_video_gdata',

    getData: function(urlMatch, request, options, cb) {

        var api_key = options.getProviderOptions('youtube.api_key');

        if (!api_key) {
            return cb (new Error ("No youtube.api_key configured"));
        }

        var statsUri = "https://www.googleapis.com/youtube/v3/videos?part=id%2Csnippet%2Cstatistics%2CcontentDetails%2Cplayer&key=" + api_key + "&id=" + urlMatch[1];

        request({
            uri: statsUri,
            json: true,
            prepareResult: function(error, b, data, cb) {

                if (error) {
                    return cb(error);
                }

                if (data.items && data.items.length > 0) {

                    var entry = data.items[0];

                    var duration = 0;
                    var durationStr = entry.contentDetails && entry.contentDetails.duration;
                    if (durationStr) {
                        var m = durationStr.match(/(\d+)S/);
                        if (m) {
                            duration += parseInt(m[1]);
                        }
                        m = durationStr.match(/(\d+)M/);
                        if (m) {
                            duration += parseInt(m[1]) * 60;
                        }
                        m = durationStr.match(/(\d+)H/);
                        if (m) {
                            duration += parseInt(m[1]) * 60 * 60;
                        }
                    }

                    var gdata = {
                        id: urlMatch[1],
                        title: entry.snippet && entry.snippet.title,
                        uploaded: entry.snippet && entry.snippet.publishedAt,
                        uploader: entry.snippet && entry.snippet.channelTitle,
                        description: entry.snippet && entry.snippet.description,
                        likeCount: entry.statistics && entry.statistics.likeCount,
                        dislikeCount: entry.statistics && entry.statistics.dislikeCount,
                        viewCount: entry.statistics && entry.statistics.viewCount,

                        hd: entry.contentDetails && entry.contentDetails.definition == "hd",
                        playerHtml: entry.player && entry.player.embedHtml
                    };

                    if (entry.snippet && entry.snippet.thumbnails ) {
                        gdata.thumbnails =  {mq: entry.snippet.thumbnails.medium, hq: entry.snippet.thumbnails.high, maxres: entry.snippet.thumbnails.maxres};
                    }

                    if (duration) {
                        gdata.duration = duration;
                    }

                    cb(null, {
                        youtube_video_gdata: gdata
                    });

                } else if (data.error && (data.error.code == 400 || data.error.code == 429)) {

                    cb(null); // // silence error for fallback to generic providers. 429 - too many requests; 400 - probably API key is invalid

                } else {

                    cb({responseStatusCode: 404});
                }
            }
        }, cb);
    },

    getMeta: function(youtube_video_gdata) {
        return {
            title: youtube_video_gdata.title,
            date: youtube_video_gdata.uploaded,
            author: youtube_video_gdata.uploader,
            category: youtube_video_gdata.category,
            description: youtube_video_gdata.description,
            duration: youtube_video_gdata.duration,
            likes: youtube_video_gdata.likeCount,
            dislikes: youtube_video_gdata.dislikeCount,
            views: youtube_video_gdata.viewCount,
            site: "YouTube"
        };
    },

    getLinks: function(url, youtube_video_gdata, options) {

        var params = options.getProviderOptions('youtube.get_params', '');

        /** Extract ?t=12m15s, ?t=123, ?start=123, ?stop=123, ?end=123
        */
        try {     
            var start = url.match(/(?:t|start)=(\d+(?:m)?\d+(?:s)?)/i);
            var end = url.match(/(?:stop|end)=(\d+(?:m)?\d+(?:s)?)/i);

            if (start) {

                var m = start[1].match(/(\d+)m/);
                var s = start[1].match(/(\d+)s/);
                var time = 0;
                if (m) {
                    time = 60 * m[1];
                }
                if (s) {
                    time += 1 * s[1];
                }
                
                params = params + (params.indexOf ('?') > -1 ? "&": "?") + "start=" + (time ? time : start[1]);
            }

            if (end) {
                params = params + (params.indexOf ('?') > -1 ? "&": "?") + "end=" + end[1];
            }
        } catch (ex) {/* and ignore */}
        // End of time extractions

        var autoplay = params + (params.indexOf ('?') > -1 ? "&": "?") + "autoplay=1";

        // Detect widescreen videos. YouTube API used to have issues with returing proper aspect-ratio.
        var widescreen = youtube_video_gdata.hd; 

        if (!widescreen && youtube_video_gdata.playerHtml) { // maybe still widescreen
            var $container = cheerio('<div>');
            try {
                $container.html(youtube_video_gdata.playerHtml);
            } catch (ex) {}

            var $iframe = $container.find('iframe');

            if ($iframe.length == 1 && $iframe.attr('width') && $iframe.attr('height') && $iframe.attr('height') > 0) {
                widescreen =  $iframe.attr('width') /  $iframe.attr('height') > 1.35;
            }
        }
        // End of widescreen check
        

        var links = [{
            href: 'https://www.youtube.com/embed/' + youtube_video_gdata.id + params,
            rel: [CONFIG.R.player, CONFIG.R.html5],
            type: CONFIG.T.text_html,
            "aspect-ratio": widescreen ? 16 / 9 : 4 / 3
        }, {
            href: 'https://www.youtube.com/embed/' + youtube_video_gdata.id + autoplay,
            rel: [CONFIG.R.player, CONFIG.R.html5, CONFIG.R.autoplay],
            type: CONFIG.T.text_html,
            "aspect-ratio": widescreen ? 16 / 9 : 4 / 3
        }, {
            href: youtube_video_gdata.thumbnails.mq && youtube_video_gdata.thumbnails.mq.url,
            rel: CONFIG.R.thumbnail,
            type: CONFIG.T.image_jpeg,
            width: 320,
            height: 180
        }];

        if (youtube_video_gdata.thumbnails.maxres) {
            links.push({
                href: youtube_video_gdata.thumbnails.maxres.url,
                rel: CONFIG.R.thumbnail,
                type: CONFIG.T.image_jpeg
                // remove width so that image is checked for 404 as well 
                // - there is no other way to make sure image is accurate AND exists.
                // width: 1280,  // sometimes the sizes are 1920x1080, but it is impossible to tell based on API. 
                // height: 720   // Image load will take unnecessary time, so we hard code the size since aspect ratio is the same
            });
        } 

        if (!widescreen) {
            links.push({
                href: youtube_video_gdata.thumbnails.hq && youtube_video_gdata.thumbnails.hq.url,
                rel: CONFIG.R.thumbnail,
                type: CONFIG.T.image_jpeg,
                width: 480,
                height: 360
            });
        }

        return links;
    },

    tests: [{
        noFeeds: true
    },
        "http://www.youtube.com/watch?v=etDRmrB9Css",
        "http://www.youtube.com/embed/Q_uaI28LGJk"
    ]
};
