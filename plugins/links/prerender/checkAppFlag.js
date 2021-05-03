module.exports = {

    provides: '__appFlag',

    getData: function(meta, cb) {

        const title = (meta.og && meta.og.title) || (meta.twitter && meta.twitter.title) || meta.title || meta['html-title'];
        const maybeApp = 
            meta.fragment === '!' && (/{{.+}}/.test(title) || !meta.og && !meta.twitter)
            || meta.og && !meta.og.title && meta.og.site_name === title; // e.g. Medium

        if (maybeApp
            || meta['prerender-status-code'] 
            || /^{{.+}}$/.test(title))  {
            //ex.:  http://www.hitbox.tv/wavybabygaming
            //      http://bteekh.com/5orm/post/9695/?ref=related
            //      https://maps.mysidewalk.com/a4c623c9fd
            //      https://www.vfiles.com/news/i-want-to-show-the-fashion-industry-that-the-future-is-coming-model-lilwavii-on-his-digital-breakthrough
            //      https://uwaterloo.ca/101-days/engineering-101-day

            return cb(null, {
                __appFlag: true,
                message: "This looks like JS app with no prerender. If you are the owner, please run templates on the server for <a href=\"https://iframely.com/docs/about\">Iframely robot</a>."
            });
        } else {
            return cb();
        }

    }
};