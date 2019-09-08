import { Table } from '../Table'
import { LuaType, Config, coerceArgToNumber } from '../utils'
import { LuaError } from '../LuaError'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
]
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// LUA uses strftime internally (https://en.cppreference.com/w/c/chrono/strftime)
type Format =
    | '%' // [string] literal %
    | 'Y' // [number] year (e.g. 2017)
    | 'y' // [number] last 2 digits of year (range [00,99])
    | 'b' // [string] abbreviated month name (e.g. Oct)
    | 'B' // [string] full month name (e.g. October)
    | 'm' // [number] month (range [01,12])
    | 'U' // [number] week of the year (Sunday is the first day of the week) (range [00,53])
    | 'W' // [number] week of the year (Monday is the first day of the week) (range [00,53])
    | 'j' // [number] day of the year (range [001,366])
    | 'd' // [number] day of the month (range [01,31])
    | 'a' // [string] abbreviated weekday name (e.g. Fri)
    | 'A' // [string] full weekday name (e.g. Friday)
    | 'w' // [number] weekday - Sunday is 0 (range [0-6])
    | 'H' // [number] hour - 24 hour format (range [00-23])
    | 'I' // [number] hour - 12 hour format (range [01,12])
    | 'M' // [number] minute (range [00,59])
    | 'S' // [number] second (range [00,60])
    | 'c' // [string] standard date and time string (e.g. Sun Oct 17 04:41:13 2010)
    | 'x' // [string] date (e.g. 09/16/98)
    | 'X' // [string] time (e.g. 23:48:10)
    | 'p' // [string] a.m. or p.m.
    | 'Z' // [string] locale-dependent time zone name or abbreviation (e.g. UTC)

const DATE_FORMAT_HANDLERS: Record<Format, (date: Date, utc: boolean) => string> = {
    '%': () => '%',
    Y: (date, utc) => `${utc ? date.getUTCFullYear() : date.getFullYear()}`,
    y: (date, utc) => DATE_FORMAT_HANDLERS.Y(date, utc).substr(-2),
    b: (date, utc) => DATE_FORMAT_HANDLERS.B(date, utc).substr(0, 3),
    B: (date, utc) => MONTHS[utc ? date.getUTCMonth() : date.getMonth()],
    m: (date, utc) => `0${(utc ? date.getUTCMonth() : date.getMonth()) + 1}`.substr(-2),
    U: (date, utc) => getWeekOfYear(date, 0, utc),
    W: (date, utc) => getWeekOfYear(date, 1, utc),
    j: (date, utc) => {
        let result = utc ? date.getUTCDate() : date.getDate()
        const month = utc ? date.getUTCMonth() : date.getMonth()
        const year = utc ? date.getUTCFullYear() : date.getFullYear()

        result += DAYS_IN_MONTH.slice(0, month).reduce((sum, n) => sum + n, 0)

        if (month > 1 && year % 4 === 0) {
            result += 1
        }

        return `00${result}`.substr(-3)
    },
    d: (date, utc) => `0${utc ? date.getUTCDate() : date.getDate()}`.substr(-2),
    a: (date, utc) => DATE_FORMAT_HANDLERS.A(date, utc).substr(0, 3),
    A: (date, utc) => DAYS[utc ? date.getUTCDay() : date.getDay()],
    w: (date, utc) => `${utc ? date.getUTCDay() : date.getDay()}`,
    H: (date, utc) => `0${utc ? date.getUTCHours() : date.getHours()}`.substr(-2),
    I: (date, utc) => `0${(utc ? date.getUTCHours() : date.getHours()) % 12 || 12}`.substr(-2),
    M: (date, utc) => `0${utc ? date.getUTCMinutes() : date.getMinutes()}`.substr(-2),
    S: (date, utc) => `0${utc ? date.getUTCSeconds() : date.getSeconds()}`.substr(-2),
    c: (date, utc) => date.toLocaleString(undefined, utc ? { timeZone: 'UTC' } : undefined),
    x: (date, utc) => {
        const m = DATE_FORMAT_HANDLERS.m(date, utc)
        const d = DATE_FORMAT_HANDLERS.d(date, utc)
        const y = DATE_FORMAT_HANDLERS.y(date, utc)
        return `${m}/${d}/${y}`
    },
    X: (date, utc) => {
        const h = DATE_FORMAT_HANDLERS.H(date, utc)
        const m = DATE_FORMAT_HANDLERS.M(date, utc)
        const s = DATE_FORMAT_HANDLERS.S(date, utc)
        return `${h}:${m}:${s}`
    },
    p: (date, utc) => ((utc ? date.getUTCHours() : date.getHours()) < 12 ? 'AM' : 'PM'),
    Z: (date, utc) => {
        if (utc) return 'UTC'
        const match = date.toString().match(/[A-Z][A-Z][A-Z]/)
        return match ? match[0] : ''
    }
}

function isDST(date: Date): boolean {
    const year = date.getFullYear()
    const jan = new Date(year, 0)

    // ASSUMPTION: If the time offset of the date is the same as it would be in January of the same year, DST is not in effect.
    return date.getTimezoneOffset() !== jan.getTimezoneOffset()
}

function getWeekOfYear(date: Date, firstDay: number, utc: boolean): string {
    const dayOfYear = parseInt(DATE_FORMAT_HANDLERS.j(date, utc), 10)
    const jan1 = new Date(date.getFullYear(), 0, 1, 12)
    const offset = (8 - (utc ? jan1.getUTCDay() : jan1.getDay()) + firstDay) % 7

    return `0${Math.floor((dayOfYear - offset) / 7) + 1}`.substr(-2)
}

function date(input = '%c', time?: number): string | Table {
    const utc = input.substr(0, 1) === '!'
    const string = utc ? input.substr(1) : input
    const date = new Date()

    if (time) {
        date.setTime(time * 1000)
    }

    if (string === '*t') {
        return new Table({
            year: parseInt(DATE_FORMAT_HANDLERS.Y(date, utc), 10),
            month: parseInt(DATE_FORMAT_HANDLERS.m(date, utc), 10),
            day: parseInt(DATE_FORMAT_HANDLERS.d(date, utc), 10),
            hour: parseInt(DATE_FORMAT_HANDLERS.H(date, utc), 10),
            min: parseInt(DATE_FORMAT_HANDLERS.M(date, utc), 10),
            sec: parseInt(DATE_FORMAT_HANDLERS.S(date, utc), 10),
            wday: parseInt(DATE_FORMAT_HANDLERS.w(date, utc), 10) + 1,
            yday: parseInt(DATE_FORMAT_HANDLERS.j(date, utc), 10),
            isdst: isDST(date)
        })
    }

    return string.replace(/%[%YybBmUWjdaAwHIMScxXpZ]/g, f => DATE_FORMAT_HANDLERS[f[1] as Format](date, utc))
}

function setlocale(locale = 'C'): string {
    if (locale === 'C') return 'C'

    // TODO: implement fully
}

function time(table?: Table): number {
    let now = Math.round(Date.now() / 1000)
    if (!table) return now

    const year = table.rawget('year') as number
    const month = table.rawget('month') as number
    const day = table.rawget('day') as number
    const hour = (table.rawget('hour') as number) || 12
    const min = table.rawget('min') as number
    const sec = table.rawget('sec') as number
    // const isdst = table.rawget('isdst') as boolean

    if (year) now += year * 31557600
    if (month) now += month * 2629800
    if (day) now += day * 86400
    if (hour) now += hour * 3600
    if (min) now += min * 60
    if (sec) now += sec
    return now
}

function difftime(t2: LuaType, t1: LuaType): number {
    const T2 = coerceArgToNumber(t2, 'difftime', 1)
    const T1 = coerceArgToNumber(t1, 'difftime', 2)
    return T2 - T1
}

const getLibOS = (cfg: Config): Table => {
    function exit(code: LuaType): void {
        if (!cfg.osExit) throw new LuaError('os.exit requires the config.osExit function')

        let CODE = 0
        if (typeof code === 'boolean' && code === false) CODE = 1
        else if (typeof code === 'number') CODE = code

        cfg.osExit(CODE)
    }

    return new Table({
        date,
        exit,
        setlocale,
        time,
        difftime
    })
}

export { getLibOS }
