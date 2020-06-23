import {init} from 'snabbdom/src/package/init'
import {h} from 'snabbdom/src/package/h'
import {attributesModule} from 'snabbdom/src/package/modules/attributes'
import {eventListenersModule} from 'snabbdom/src/package/modules/eventlisteners'
import {VNode} from 'snabbdom/src/package/vnode'
import {throttle} from 'lodash-es'

const DEFAULT_COLUMNS_COUNT = 4
const MIN_COLUMNS_COUNT = 1
const MAX_COLUMNS_COUNT = 10
const DEFAULT_COLUMNS_WIDTH = 420
const MIN_COLUMNS_WIDTH = 320
const MAX_COLUMNS_WIDTH = 4000

interface State {
	url: string,
	columnsCount: number,
	columnsWidth: number,
	hasNavColumn: boolean,
}

interface DOMEvent<T extends EventTarget> extends Event {
	target: T
}

const patch = init([
	attributesModule,
	eventListenersModule,
])

const urlSearchParams = new URLSearchParams(window.location.search)
const getUrlSearchParam = (key: string): string => {
	return urlSearchParams.get(key) || ''
}

const url: string = getUrlSearchParam('url')
const columnsCount: number = parseInt(getUrlSearchParam('columnsCount')) || DEFAULT_COLUMNS_COUNT
const columnsWidth: number = parseInt(getUrlSearchParam('columnsWidth')) || DEFAULT_COLUMNS_WIDTH
const hasNavColumn = true
const app: HTMLElement = document.getElementById('app') as HTMLElement

const state: State = {
	url,
	columnsCount,
	columnsWidth,
	hasNavColumn,
}

let scrollingSourceIndex: number | undefined
let scrollingSourceTimeout: number | undefined

function scroll(columnIndex: number): void {
	const columns = document.querySelectorAll('.column:not(.nav-column)')
	const scrollTop = Math.max(0, columns[columnIndex].scrollTop)
	const columnHeight = columns[columnIndex].getBoundingClientRect().height
	const minScrollTop = columnHeight * columnIndex

	if (scrollingSourceIndex !== undefined && scrollingSourceIndex !== columnIndex) {
		return
	}

	if (scrollTop < minScrollTop) {
		columns[columnIndex].scrollTop = minScrollTop

		columns.forEach((column, index) => {
			// Set the computed minScrollTop for each column
			column.scrollTop = columnHeight * index
		})

		return
	}

	scrollingSourceIndex = columnIndex

	columns.forEach((column, index) => {
		if (index === columnIndex) {
			return
		}

		const newScrollTop = scrollTop + columnHeight * (index - columnIndex)

		column.scrollTop = newScrollTop
	})

	clearTimeout(scrollingSourceTimeout)
	scrollingSourceTimeout = window.setTimeout(() => {
		scrollingSourceIndex = undefined
	}, 100)
}

function updateHistory(state: State): void {
	const baseUrl = window.location.origin + window.location.pathname
	const searchParams = new URLSearchParams()
	searchParams.set('url', state.url)
	searchParams.set('columnsCount', state.columnsCount.toString())
	searchParams.set('columnsWidth', state.columnsWidth.toString())
	const newUrl = `${baseUrl}?${searchParams.toString()}`

	window.history.replaceState(null, '', newUrl)
}

const setColumnsCount = throttle((newColumnsCount: number): void => {
	state.columnsCount = newColumnsCount
	updateHistory(state)
	render(state)
}, 100)

const onUrlChange = throttle((e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	state.url = event.target.value
	updateHistory(state)
	render(state)
}, 100)

const onColumnsWidthChange = throttle((e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	state.columnsWidth = parseInt(event.target.value)
	updateHistory(state)
	render(state)
}, 100)

function view(state: State): VNode {
	const columns: VNode[] = [...Array<null>(state.columnsCount)].map((_, index) => {
		return h('div.column',
			{
				// @ts-ignore: Wrong typing in Snabbdom lib
				on: {scroll: [scroll, index]},
			},
			[
				h('iframe', {attrs: {src: state.url, frameborder: '0', scrolling: 'no'}}),
			],
		)
	})

	if (state.hasNavColumn) {
		// Add nav column
		columns.unshift(
			h('div.column.nav-column',
				[
					h('div.nav-column--container', {},[
						h('iframe', {attrs: {src: state.url, frameborder: '0', scrolling: 'no'}}),
					]),
				],
			)
		)
	}

	return h('div#app', {attrs: {style: `--columns-count: ${state.columnsCount}; --columns-width: ${state.columnsWidth}px`}}, [
		h('div.options', [
			h('div.field', [
				h('input', {attrs: {type: 'url', name: 'url', id: 'url', value: state.url}, on: {change: onUrlChange}}),
				h('input', {
					attrs: {type: 'number', name: 'columnsWidth', id: 'columnsWidth', min: MIN_COLUMNS_WIDTH, max: MAX_COLUMNS_WIDTH, value: state.columnsWidth},
					on: {change: onColumnsWidthChange},
				}),
			]),
			h('div.field', [
				h('button', {
					// @ts-ignore: Wrong typing in Snabbdom lib
					on: {click: [setColumnsCount, state.columnsCount + 1]},
					attrs: {disabled: state.columnsCount >= MAX_COLUMNS_COUNT},
				}, 'Add a column'),
				h('button', {
					// @ts-ignore: Wrong typing in Snabbdom lib
					on: {click: [setColumnsCount, state.columnsCount - 1]},
					attrs: {disabled: state.columnsCount <= MIN_COLUMNS_COUNT},
				}, 'Remove a column'),
			]),
		]),
		h('div.columns', columns),
	])
}

let oldVNode: VNode

function render(state: State) {
	const newVNode = view(state)
	patch(oldVNode || app, newVNode)
	oldVNode = newVNode

	scroll(0)
}

render(state)
