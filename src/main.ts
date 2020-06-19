import {init} from 'snabbdom/src/package/init'
import {h} from 'snabbdom/src/package/h'
import {attributesModule} from 'snabbdom/src/package/modules/attributes'
import {eventListenersModule} from 'snabbdom/src/package/modules/eventlisteners'
import {VNode} from 'snabbdom/src/package/vnode'

interface State {
	url: string,
	columnsCount: number,
}

interface DOMEvent<T extends EventTarget> extends Event {
	target: T
}

const patch = init([
	attributesModule,
	eventListenersModule,
])

const urlSearchParams = new URLSearchParams(window.location.search)
const url = urlSearchParams.get('url') || ''
const columnsCount: number = parseInt(urlSearchParams.get('columnsCount') || '4')
const app = document.getElementById('app')

const state = {
	url,
	columnsCount,
}

let scrollingSourceIndex: number | undefined
let scrollingSourceTimeout: NodeJS.Timeout

function scroll(columnIndex: number): void {
	if (scrollingSourceIndex !== undefined && scrollingSourceIndex !== columnIndex) {
		return
	}

	scrollingSourceIndex = columnIndex

	const columns = document.querySelectorAll('.column')
	const scrollTop = columns[columnIndex].scrollTop
	const columnHeight = columns[columnIndex].getBoundingClientRect().height

	columns.forEach((column, index) => {
		if (index === columnIndex) {
			return
		}

		column.scrollTop = scrollTop + columnHeight * (index - columnIndex)
	})

	clearTimeout(scrollingSourceTimeout)
	scrollingSourceTimeout = setTimeout(() => {
		scrollingSourceIndex = undefined
	}, 100)
}

function updateHistory(state: State): void {
	const baseUrl = window.location.origin + window.location.pathname
	const searchParams = new URLSearchParams()
	searchParams.set('url', state.url)
	searchParams.set('columnsCount', state.columnsCount.toString())
	const newUrl = `${baseUrl}?${searchParams.toString()}`

	window.history.replaceState(null, '', newUrl)
}

function setColumnsCount(newColumnsCount: number): void {
	state.columnsCount = newColumnsCount
	updateHistory(state)
	render(state)
}

function onUrlChange(e: Event): void {
	const event = e as DOMEvent<HTMLInputElement>
	state.url = event.target.value
	updateHistory(state)
	render(state)
}

function view(state: State): VNode {
	const columns = [...Array<null>(state.columnsCount)].map((_, index) => {
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

	return h('div#app', {attrs: {style: `--columns-count: ${state.columnsCount}`}}, [
		h('div.options', [
			h('div.field', [
				h('input', {attrs: {type: 'url', name: 'url', id: 'url', value: state.url}, on: {change: onUrlChange}}),
			]),
			h('div.field', [
				h('button', {
					// @ts-ignore: Wrong typing in Snabbdom lib
					on: {click: [setColumnsCount, state.columnsCount + 1]},
					attrs: {disabled: state.columnsCount >= 10},
				}, 'Add a column'),
				h('button', {
					// @ts-ignore: Wrong typing in Snabbdom lib
					on: {click: [setColumnsCount, state.columnsCount - 1]},
					attrs: {disabled: state.columnsCount <= 1},
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
