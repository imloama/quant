import {cons, rest} from '../base';
import {map, mergeMap, reduce, tap} from 'rxjs/operators';
import {from} from 'rxjs';

export default class Account {
    constructor (authService){
        this.authService = authService
    }

    getAccounts (type){
        if(this.account){
            return Promise.resolve(this.account) 
        }

        return from(rest.get(cons.Accounts, this.authService.addSignature(cons.Accounts, cons.GET, {}))).pipe(
            map(data => data.data),
            mergeMap(datas => from(datas)),
            reduce((acc, value)=>{
                acc.set(value.type, value)
                return acc
            }, new Map()),
            tap(data => {this.account = data}),
            map(data => data.get(type))
        ).toPromise()
    }

    getAccountByType (type){
        return from(this.getAccounts).pipe(
            map(data => data.get(type))
        ).toPromise()
    }

    getBalance (account) {
        const url = `${cons.Accounts}/${account.id}/balance`
        return from(rest.get(url, this.authService.addSignature(url, cons.GET, {}))).pipe(
            map(data => data.data)
        ).toPromise()
    }
}