import * as request from 'request'

import {
    from
} from 'rxjs'
import {getLogger} from 'log4js';

const get = function get (host, params) {

    return from(
        new Promise((resolve, reject) => {
            getLogger().debug(host, params)
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

                // getLogger('debug').debug(body)
                resolve(JSON.parse(body))
            })
        })
    )
}
const post = function post (host, params, queryParams) {

    return from(
        new Promise((resolve, reject) => {
            getLogger().debug(host, params)

            request.post(host, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
                },
                qs: queryParams,
                json: params
            }, (err, res, body) => {
                if (err) {
                    reject(err)
                    return
                }

                getLogger().debug(JSON.stringify(body))

                resolve(body)
            })
        })
    )
}


export {
    get,
    post
}