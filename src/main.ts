import {init} from 'snabbdom/src/package/init'
import {h} from 'snabbdom/src/package/h'
import {attributesModule} from 'snabbdom/src/package/modules/attributes'
import {classModule} from 'snabbdom/src/package/modules/class'
import {eventListenersModule} from 'snabbdom/src/package/modules/eventlisteners'
import {VNode} from 'snabbdom/src/package/vnode'
import {throttle} from 'lodash-es'
import {v4 as uuid} from 'uuid'

const DEFAULT_DISPLAY_MODE = 'single-page'
const DEFAULT_COLUMNS_COUNT = 5
const MIN_COLUMNS_COUNT = 1
const MAX_COLUMNS_COUNT = 10
const DEFAULT_COLUMNS_WIDTH = 375
const MIN_COLUMNS_WIDTH = 280
const MAX_COLUMNS_WIDTH = 4000
const DEVICES = [
	{
		'name': 'iPhone 5/SE',
		'width': 320,
	},
	{
		'name': 'Moto G / Galaxy S5',
		'width': 360,
	},
	{
		'name': 'iPhone 6/7/8/X',
		'width': 375,
	},
	{
		'name': 'iPhone 6/7/8 Plus',
		'width': 414,
	},
	{
		'name': 'iPad',
		'width': 768,
	},
]

type DisplayMode = 'single-page' | 'multi-page'
type IconId = 'column-count' | 'screen-size' | 'url' | 'type'

interface State {
	displayMode: DisplayMode,
	url: string,
	urls: string[],
	columnsCount: number,
	columnsWidth: number,
	columnWidthCharCount: number,
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
	classModule,
	eventListenersModule,
])

const urlSearchParams = new URLSearchParams(window.location.search)
const getUrlSearchParam = (key: string): string => {
	return urlSearchParams.get(key) || ''
}

const displayMode: DisplayMode = getUrlSearchParam('displayMode') as DisplayMode || DEFAULT_DISPLAY_MODE
const url: string = getUrlSearchParam('url')
const urls: string[] = urlSearchParams.getAll('urls') || []
const columnsCount: number = parseInt(getUrlSearchParam('columnsCount')) || DEFAULT_COLUMNS_COUNT
const columnsWidth: number = parseInt(getUrlSearchParam('columnsWidth')) || DEFAULT_COLUMNS_WIDTH
const hasNavColumn = true
const app: HTMLElement = document.getElementById('app') as HTMLElement

const state: State = {
	displayMode,
	url,
	urls,
	columnsCount,
	columnsWidth,
	columnWidthCharCount: columnsWidth.toString().length,
	columnsHeight: 0,
	scrollTop: 0,
	hasNavColumn,
	loadedIframeIds: new Set<string>(),
}

let scrollingSourceIndex: number | undefined
let scrollingSourceTimeout: number | undefined

function scroll(state: State, columnIndex: number): void {
	const columns = document.querySelectorAll('.column:not(.nav-column)')
	const scrollTop = Math.max(0, columns[columnIndex].scrollTop)
	const columnsHeight = columns[columnIndex].getBoundingClientRect().height

	if (scrollingSourceIndex !== undefined && scrollingSourceIndex !== columnIndex) {
		return
	}

	if (state.displayMode === 'single-page') {
		const minScrollTop = columnsHeight * columnIndex

		if (scrollTop < minScrollTop) {
			columns[columnIndex].scrollTop = minScrollTop

			// Set the computed minScrollTop for each column
			columns.forEach((column, index) => {
				column.scrollTop = columnsHeight * index
			})

			return
		}
	}

	scrollingSourceIndex = columnIndex

	columns.forEach((column, index) => {
		if (index === columnIndex) {
			return
		}

		if (state.displayMode === 'multi-page') {
			column.scrollTop = scrollTop
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
	app.setAttribute('style', `--columns-height: ${columnsHeight}px; --scroll-top: ${navScrollTop}px`)
}

function updateHistory(state: State): void {
	const baseUrl = window.location.origin + window.location.pathname
	const searchParams = new URLSearchParams()
	searchParams.set('displayMode', state.displayMode)
	if (state.displayMode === 'single-page') {
		searchParams.set('url', state.url)
	} else {
		state.urls.forEach((url) => {
			searchParams.append('urls', url)
		})
	}
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

const onUrlChange = throttle((state: State, index: number | null, e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	event.target.blur()

	// Prefix with https:// when needed
	let url = event.target.value
	if (!url.startsWith('http')) {
		url = 'https://' + url
	}

	if (index === null) {
		state.url = url
	} else {
		state.urls[index] = url
	}
	updateHistory(state)

	if (IS_PRODUCTION) {
		const urlProtocol = state.url.split(':')[0]
		if (window.location.protocol !== `${urlProtocol}:`) {
			window.location.replace(`${urlProtocol}:${location.href.substring(location.protocol.length)}`)
			return
		}
	}

	render(state)

	// Force value update
	event.target.value = url
}, 100)

const onColumnsWidthChange = throttle((e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	state.columnsWidth = parseInt(event.target.value)
	state.columnWidthCharCount = event.target.value.length
	updateHistory(state)
	render(state)

	event.target.value = state.columnsWidth.toString()
}, 100)

const onClickScreenSizeItem = (columnsWidth: number): void => {
	state.columnsWidth = columnsWidth
	state.columnWidthCharCount = columnsWidth.toString().length
	updateHistory(state)
	render(state)
}

const onDisplayModeChange = (e: Event): void => {
	const event = e as DOMEvent<HTMLInputElement>
	state.displayMode = event.target.value as DisplayMode
	updateHistory(state)
	render(state)
}

const onIframeLoad = (state: State, index: number | null, e: Event): void => {
	const iframe = e.target as HTMLIFrameElement

	if (iframe.src === undefined) {
		return
	}

	if (!state.loadedIframeIds.has(iframe.id)) {
		state.loadedIframeIds.add(iframe.id)
		return
	}

	state.loadedIframeIds.delete(iframe.id)

	const url = state.displayMode === 'single-page' ? state.url : state.urls[index || 0]
	iframe.src = url
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

function getDeviceNameByWidth(width: number): string | undefined {
	const device = DEVICES.find((device) => device.width === width)
	if (device === undefined) {
		return 'Custom'
	}

	return device.name
}

function view(state: State): VNode {
	const columns: VNode[] = [...Array<null>(state.columnsCount)].map((_, index) => {
		const url = state.displayMode === 'single-page' ? state.url : state.urls[index]
		return h('div.column',
			{
				on: {
					// @ts-ignore: Wrong typing in Snabbdom lib
					scroll: [scroll, state, index],
				},
			},
			[
				state.displayMode === 'multi-page' ? h('div.column-url', [
					h('div.column-url--icon', [
						icon('url'),
					]),
					h('div.column-url--content', [
						h('label.column-url--title', {
							attrs: {for: `column-url-${index}`},
						}, 'URL'),
						h('div.column-url--field', [
							h('input', {
								attrs: {
									type: 'url',
									name: `column-url-${index}`,
									id: `column-url-${index}`,
									value: url,
									placeholder: 'https://example.com',
								},
								on: {
									change: (e: Event) => {
										onUrlChange(state, index, e)
									},
								},
							}),
						]),
					]),
				]) : null,
				url ? h('iframe', {
					attrs: {
						src: url,
						id: uuid(),
						frameborder: '0',
						scrolling: 'no',
					},
					on: {
						load: (e: Event) => {
							onIframeLoad(state, index, e)
						},
					},
				}) : null,
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

	// Generate screen size dropdown
	const columnsWidthDevices = DEVICES.map((device) => {
		return h('div.header-block--dropdown-item', {
			on: {
				// @ts-ignore: Wrong typing in Snabbdom lib
				click: [onClickScreenSizeItem, device.width],
			},
		}, [
			h('div', device.name),
			h('div.header-block--dropdown-item-details', device.width + 'px'),
		])
	})

	// Generate the view
	return h('div#app', [
		h('header', [
			h('div.header-block.header-block__logo', [
				h('div.header-logo--overlay'),
				h('div.header-logo', [
					'Column View',
				]),
				h('div.header-logo--details', [
					h('p', [
						'Column view is a tool that helps you view the mobile version of your website directly in multiple columns or helps you check multiple pages at once.',
					]),
					h('div', [
						'Design',
						h('a', {
							attrs: {
								href: 'https://twitter.com/adriengervaix',
								target: '_blank',
							},
						}, '@adriengervaix'),
						h('br'),
						'Development',
						h('a', {
							attrs: {
								href: 'https://twitter.com/AlexandreDemode',
								target: '_blank',
							},
						}, '@AlexandreDemode'),
					]),
					h('div.header-logo--see-on-github', [
						'Open Source under MIT License',
						h('a', {
							attrs: {
								href: 'https://github.com/Alex-D/Column-View',
								target: '_blank',
							},
						},'See on GitHub'),
					]),
				]),
			]),
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
			h('div.header-block.header-block__focus-within', {
				class: {
					'header-block__disabled': state.displayMode === 'multi-page',
				},
			},[
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
								disabled: state.displayMode === 'multi-page',
							},
							on: {
								change: (e: Event) => {
									onUrlChange(state, null, e)
								},
							},
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
			h('div.header-block.header-block__focus-within', [
				h('div.header-block--icon', [
					icon('screen-size'),
				]),
				h('div.header-block--content', [
					h('label.header-block--title', {
						attrs: {for: 'columnsWidth'},
					}, 'Screen size'),
					h('div.header-block--field.header-block--field-screen-size', [
						h('input', {
							attrs: {
								type: 'number',
								name: 'columnsWidth',
								id: 'columnsWidth',
								min: MIN_COLUMNS_WIDTH,
								max: MAX_COLUMNS_WIDTH,
								value: state.columnsWidth,
								style: `--input-content-width: ${state.columnWidthCharCount}`,
							},
							on: {
								change: onColumnsWidthChange,
								input: (e: Event): void => {
									const event = e as DOMEvent<HTMLInputElement>
									const previousColumnWidthCharCount = state.columnWidthCharCount
									state.columnWidthCharCount = event.target.value.length
									if (previousColumnWidthCharCount !== state.columnWidthCharCount) {
										render(state)
									}
								},
							},
						}),
						h('input', {
							attrs: {
								value: `px — ${getDeviceNameByWidth(state.columnsWidth)}`,
								disabled: 'disabled',
							},
						}),
					]),
				]),
				h('div.header-block--dropdown', columnsWidthDevices),
			]),
		]),
		h('div.columns', {
			class: {
				'columns__multi-page': state.displayMode === 'multi-page',
			},
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
		scroll(state, 0)
	})
}

const throttledRender = throttle(render, 50)

window.addEventListener('resize', () => throttledRender(state))

const initState = Object.assign({}, state)
initState.url = ''
initState.urls = []
render(initState)

setTimeout(() => {
	document.body.classList.add('loaded')
	render(state)
}, 1000)
