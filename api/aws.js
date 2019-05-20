const crypto = require('crypto')

import * as url from 'url'
import {getLogger} from 'log4js';

const getUTCTime = function getUTCTime () {
    return new Date().toISOString().slice(0, -5)
}

const addSignature = function addSignature (queryParams, awsParams) {
    const timeStamp = getUTCTime()
    queryParams.params.Timestamp = encodeURIComponent(timeStamp)
    queryParams.params.SignatureMethod = 'HmacSHA256'
    queryParams.params.SignatureVersion = '2'
    queryParams.params.AccessKeyId = awsParams.id

    const sorted = {}
    Object.keys(queryParams.params).sort().forEach(key => {
        sorted[key] = queryParams.params[key]
    })


    const urlInfo = url.parse(queryParams.url)
    let toBeSigned = `${queryParams.method.toUpperCase()}\n` +
        `${urlInfo.host}\n` +
        `${urlInfo.path}\n` +
        `${Object.keys(sorted).map(key => key + '=' + sorted[key]).join('&')}`

    getLogger().info(toBeSigned)
    const signature = crypto.createHmac('sha256', awsParams.key).update(toBeSigned, 'utf8').digest('base64')
    queryParams.params.Signature = signature

    queryParams.params.Timestamp = timeStamp

    return queryParams.params
}


export {
    addSignature
}