import {BaseCurrency} from './const'

const getSymbolInfo = function getSymbolInfo (symbol){
    for(let base of BaseCurrency){
        const index = symbol.indexOf(base)
        if (index <0){
            continue
        }

        if(index + base.length === symbol.length){
            return {
                base,
                trader: symbol.substring(0, index)
            }
        }
    }

    return null
}

module.exports = {
    getSymbolInfo
}