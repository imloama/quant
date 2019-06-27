import {cons, rest} from '../base';
import {map, mergeMap, reduce, tap} from 'rxjs/operators';
import {from} from 'rxjs';
import {getLogger} from 'log4js';

export default class Account {
    constructor (authService){
        this.authService = authService
    }

    getAccounts (type){
        if(this.account){
            getLogger().debug(`use cache account:${this.account}`)
            return Promise.resolve(this.account.get(type)) 
        }

        return from(rest.get(cons.AccountAPI + cons.Accounts, this.authService.addSignature(cons.AccountAPI + cons.Accounts, cons.GET, {}))).pipe(
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
        return from(this.getAccounts(type)).pipe(
        ).toPromise()
    }

    getBalance (account) {
        const url = `${cons.AccountAPI + cons.Accounts}/${account.id}/balance`
        return from(rest.get(url, this.authService.addSignature(url, cons.GET, {}))).pipe(
            map(data => data.data)
        ).toPromise()
    }
}