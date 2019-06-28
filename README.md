# quant
Use API to trade digital asset

## Introduction
I want to write a program to auto trade digital asset(btc for example) with certain stragy. For now, this project only support one stragy with in one exchange. And I will keep working on it.

### Stragy
  + Grid trade
    
    Set a price range and splite it into serval prices. Make a trade when prices reached.
  
    | price | buy | sell |
    | -- | -- | -- |
    | 1 | buy1 | |
    | 2 | buy2 | sell1 |
    | 3 | buy3 | sell2 |
    | 4 | | sell3 |
    
### Exchange
  + Huobi

## Usage
1. Make a copy of `config.example.js` to `config.js` and fill it with your own info.
2. Run `npm run client` and follow the command to build a task.
3. Run `npm run start`.
