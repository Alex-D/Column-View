import {init} from 'snabbdom/src/package/init'
import {h} from 'snabbdom/src/package/h'
import {attributesModule} from 'snabbdom/src/package/modules/attributes'
import {eventListenersModule} from 'snabbdom/src/package/modules/eventlisteners'
import {VNode} from 'snabbdom/src/package/vnode'
import {throttle} from 'lodash-es'
import {v4 as uuid} from 'uuid'

const DEFAULT_DISPLAY_MODE = 'single-page'
const DEFAULT_COLUMNS_COUNT = 5
const MIN_COLUMNS_COUNT = 1
const MAX_COLUMNS_COUNT = 10
const DEFAULT_COLUMNS_WIDTH = 380
const MIN_COLUMNS_WIDTH = 320
const MAX_COLUMNS_WIDTH = 4000

type DisplayMode = 'single-page' | 'multi-page'
type IconId = 'column-count' | 'screen-size' | 'url' | 'type'

interface State {
	displayMode: DisplayMode,
	url: string,
	columnsCount: number,
	columnsWidth: number,
	columnsHeight: number,
	scrollTop: number,
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
	columnsHeight: 0,
	scrollTop: 0,
	hasNavColumn,
	loadedIframeIds: new Set<string>(),
}

let scrollingSourceIndex: number | undefined
let scrollingSourceTimeout: number | undefined

function scroll(columnIndex: number): void {
	const columns = document.querySelectorAll('.column:not(.nav-column)')
	const scrollTop = Math.max(0, columns[columnIndex].scrollTop)
	const columnsHeight = columns[columnIndex].getBoundingClientRect().height
	const minScrollTop = columnsHeight * columnIndex

	if (scrollingSourceIndex !== undefined && scrollingSourceIndex !== columnIndex) {
		return
	}

	if (scrollTop < minScrollTop) {
		columns[columnIndex].scrollTop = minScrollTop

		columns.forEach((column, index) => {
			// Set the computed minScrollTop for each column
			column.scrollTop = columnsHeight * index
		})

		return
	}

	scrollingSourceIndex = columnIndex

	columns.forEach((column, index) => {
		if (index === columnIndex) {
			return
		}

		const newScrollTop = scrollTop + columnsHeight * (index - columnIndex)

		column.scrollTop = newScrollTop
	})

	clearTimeout(scrollingSourceTimeout)
	scrollingSourceTimeout = window.setTimeout(() => {
		scrollingSourceIndex = undefined
	}, 100)

	const navScrollTop = Math.max(0, columns[0].scrollTop)
	app.setAttribute('style',  `--columns-height: ${columnsHeight}px; --scroll-top: ${navScrollTop}px`)
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

	// Avoid outline on current activeElement without breaking accessibility
	const activeElement: Element | null = document.activeElement
	if (activeElement !== null) {
		(activeElement as HTMLElement).blur()
	}
}, 100)

const onUrlChange = throttle((e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	event.target.blur()

	// Prefix with https:// when needed
	let url = event.target.value
	if (!url.startsWith('http')) {
		url = 'https://' + url
	}

	state.url = url
	updateHistory(state)
	render(state)

	// Force value update
	event.target.value = url
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

function icon(iconId: IconId): VNode {
	return h('svg.icon', [
		h('use', {
			attrs: {
				'xlink:href': `#icon-${iconId}`,
			},
		}),
	])
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
				state.url && h('iframe', {
					attrs: {src: state.url, id: uuid(), frameborder: '0', scrolling: 'no'},
					on: {
						load: onIframeLoad,
					},
				}),
			],
		)
	})

	// Hack to get the right right padding value
	columns.push(h('div.fix-for-horizontal-scroll-right-padding'))

	// Show nav column
	if (state.displayMode === 'single-page') {
		const navColumnPlaceholders: VNode[] = [...Array<null>(state.columnsCount)].map(() => {
			return h('div.nav-column--placeholder')
		})

		// Add nav column
		columns.unshift(
			h('div.column.nav-column',
				[
					h('div.nav-column--container', [
						h(`iframe`, {
							attrs: {
								src: state.url,
								frameborder: '0',
								scrolling: 'no',
							},
						}),
						h('div.nav-column--placeholders', navColumnPlaceholders),
					]),
				],
			),
		)
	}

	return h('div#app', [
		h('header', [
			h('h1.header-block.header-logo', 'Column View'),
			h('div.header-block', [
				h('div.header-block--icon', [
					icon('type'),
				]),
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
						h('label.header-switch--item', {attrs: {for: 'switch-single-page'}}, [
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
				h('div.header-block--icon', [
					icon('url'),
				]),
				h('div.header-block--content', [
					h('label.header-block--title', {
						attrs: {for: 'url'},
					}, 'URL'),
					h('div.header-block--field', [
						h('input', {
							attrs: {
								type: 'url',
								name: 'url',
								id: 'url',
								value: state.url,
								placeholder: 'https://example.com',
							},
							on: {change: onUrlChange},
						}),
					]),
				]),
			]),
			h('div.header-block', [
				h('div.header-block--icon', [
					icon('column-count'),
				]),
				h('div.header-block--content', [
					h('div.header-block--title', 'Column count'),
					h('div.header-block--field', [
						h('button', {
							// @ts-ignore: Wrong typing in Snabbdom lib
							on: {click: [setColumnsCount, state.columnsCount - 1]},
							attrs: {disabled: state.columnsCount <= MIN_COLUMNS_COUNT},
						}, '−'),
						h('span.column-count', state.columnsCount),
						h('button', {
							// @ts-ignore: Wrong typing in Snabbdom lib
							on: {click: [setColumnsCount, state.columnsCount + 1]},
							attrs: {disabled: state.columnsCount >= MAX_COLUMNS_COUNT},
						}, '+'),
					]),
				]),
			]),
			h('div.header-block', [
				h('div.header-block--icon', [
					icon('screen-size'),
				]),
				h('div.header-block--content', [
					h('label.header-block--title', {
						attrs: {for: 'columnsWidth'},
					}, 'Screen size'),
					h('div.header-block--field.header-block--field-screen-size', {
						attrs: {
							'data-unit': 'px',
						},
					}, [
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
		]),
		h('div.columns', {
			attrs: {
				style: `--columns-count: ${state.columnsCount}; --columns-width: ${state.columnsWidth}px`,
			},
		}, columns),
	])
}

let oldVNode: VNode

function render(state: State): void {
	const newVNode = view(state)
	patch(oldVNode || app, newVNode)
	oldVNode = newVNode

	setTimeout(() => {
		scroll(0)
	})
}

const throttledRender = throttle(render, 50)

window.addEventListener('resize', () => throttledRender(state))

render(state)
