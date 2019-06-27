import {from} from 'rxjs';
import {rest, cons} from '../base';
import {filter, map} from 'rxjs/operators';

export default class market {
    static getMergedDetail (symbol) {
        return from(rest.get(cons.MarketAPI + cons.MarketDetailMerged, {
            symbol
        })).pipe(
            filter(data => data.status === 'ok'),
            map(data => data.tick)
        ).toPromise()
    }
}