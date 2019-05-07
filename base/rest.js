import * as request from 'request'
import {
    from
} from 'rxjs'

const get = function get (host, params) {
    return from(
        new Promise((resolve, reject) => {
            request.get(host, {
                qs: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
                }
            }, (err, res, body) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(JSON.parse(body))
            })
        })
    )
}

module.exports = {
    get
}