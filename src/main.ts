import {init} from 'snabbdom/src/package/init'
import {h} from 'snabbdom/src/package/h'
import {attributesModule} from 'snabbdom/src/package/modules/attributes'
import {eventListenersModule} from 'snabbdom/src/package/modules/eventlisteners'
import {VNode} from 'snabbdom/src/package/vnode'
import {throttle} from 'lodash-es'
import {v4 as uuid} from 'uuid'

const DEFAULT_DISPLAY_MODE = 'single-page'
const DEFAULT_COLUMNS_COUNT = 4
const MIN_COLUMNS_COUNT = 1
const MAX_COLUMNS_COUNT = 10
const DEFAULT_COLUMNS_WIDTH = 420
const MIN_COLUMNS_WIDTH = 320
const MAX_COLUMNS_WIDTH = 4000

type DisplayMode = 'single-page' | 'multi-page'

interface State {
	displayMode: DisplayMode,
	url: string,
	columnsCount: number,
	columnsWidth: number,
	hasNavColumn: boolean,
	loadedIframeIds: Set<string>,
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

const displayMode: DisplayMode = getUrlSearchParam('displayMode') as DisplayMode || DEFAULT_DISPLAY_MODE
const url: string = getUrlSearchParam('url')
const columnsCount: number = parseInt(getUrlSearchParam('columnsCount')) || DEFAULT_COLUMNS_COUNT
const columnsWidth: number = parseInt(getUrlSearchParam('columnsWidth')) || DEFAULT_COLUMNS_WIDTH
const hasNavColumn = true
const app: HTMLElement = document.getElementById('app') as HTMLElement

const state: State = {
	displayMode,
	url,
	columnsCount,
	columnsWidth,
	hasNavColumn,
	loadedIframeIds: new Set<string>(),
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
	searchParams.set('displayMode', state.displayMode)
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

const onDisplayModeChange = (e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	state.displayMode = event.target.value as DisplayMode
	updateHistory(state)
}

const onIframeLoad = (e: Event): void => {
	const iframe = e.target as HTMLIFrameElement

	if (iframe.src === undefined) {
		return
	}

	if (!state.loadedIframeIds.has(iframe.id)) {
		state.loadedIframeIds.add(iframe.id)
		return
	}

	state.loadedIframeIds.delete(iframe.id)
	iframe.src = state.url
}

function view(state: State): VNode {
	const columns: VNode[] = [...Array<null>(state.columnsCount)].map((_, index) => {
		return h('div.column',
			{
				on: {
					// @ts-ignore: Wrong typing in Snabbdom lib
					scroll: [scroll, index],
				},
			},
			[
				h('iframe', {
					attrs: {src: state.url, id: uuid(), frameborder: '0', scrolling: 'no'},
					on: {
						load: onIframeLoad,
					},
				}),
			],
		)
	})

	if (state.hasNavColumn) {
		// Add nav column
		columns.unshift(
			h('div.column.nav-column',
				[
					h('div.nav-column--container', [
						h(`iframe`, {attrs: {src: state.url, frameborder: '0', scrolling: 'no'}}),
					]),
				],
			),
		)
	}

	return h('div#app', {attrs: {style: `--columns-count: ${state.columnsCount}; --columns-width: ${state.columnsWidth}px`}}, [
		h('header', [
			h('h1.header-block.header-logo', 'Column View'),
			h('div.header-block', [
				h('div.header-block--icon', []),
				h('div.header-block--content', [
					h('div.header-block--title', 'Type'),
					h('div.header-switch', [
						h('input.header-switch--radio', {
							attrs: {
								id: 'switch-single-page',
								type: 'radio',
								name: 'display-mode',
								value: 'single-page',
								checked: state.displayMode === 'single-page',
							},
							on: {
								change: onDisplayModeChange,
							},
						}),
						h('label.header-switch--item', {attrs: {for: 'switch-single-page'}},  [
							'Single page',
						]),
						h('input.header-switch--radio', {
							attrs: {
								id: 'switch-multi-page',
								type: 'radio',
								name: 'display-mode',
								value: 'multi-page',
								checked: state.displayMode === 'multi-page',
							},
							on: {
								change: onDisplayModeChange,
							},
						}),
						h('label.header-switch--item', {attrs: {for: 'switch-multi-page'}}, [
							'Multi page',
						]),
					]),
				]),
			]),
			h('div.header-block', [
				h('div.header-block--icon', []),
				h('div.header-block--content', [
					h('label.header-block--title', {
						attrs: {for: 'url'},
					}, 'URL'),
					h('input', {
						attrs: {type: 'url', name: 'url', id: 'url', value: state.url},
						on: {change: onUrlChange},
					}),
				]),
			]),
			h('div.header-block', [
				h('div.header-block--icon', []),
				h('div.header-block--content', [
					h('div.header-block--title', 'Column count'),
					h('button', {
						// @ts-ignore: Wrong typing in Snabbdom lib
						on: {click: [setColumnsCount, state.columnsCount - 1]},
						attrs: {disabled: state.columnsCount <= MIN_COLUMNS_COUNT},
					}, '-'),
					h('span.column-count', state.columnsCount),
					h('button', {
						// @ts-ignore: Wrong typing in Snabbdom lib
						on: {click: [setColumnsCount, state.columnsCount + 1]},
						attrs: {disabled: state.columnsCount >= MAX_COLUMNS_COUNT},
					}, '+'),
				]),
			]),
			h('div.header-block', [
				h('div.header-block--icon', []),
				h('div.header-block--content', [
					h('div.header-block--title', 'Screen size'),
					h('input', {
						attrs: {
							type: 'number',
							name: 'columnsWidth',
							id: 'columnsWidth',
							min: MIN_COLUMNS_WIDTH,
							max: MAX_COLUMNS_WIDTH,
							value: state.columnsWidth,
						},
						on: {change: onColumnsWidthChange},
					}),
				]),
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

	setTimeout(() => {
		scroll(0)
	})
}

render(state)
