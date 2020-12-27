import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dynamic from 'next/dynamic';

// utils
import { getTableColumnSizes } from '../../../../utils/StyleUtils';
import { isArray, isFunction, isUndefined } from '../../../../utils/Utils';

// styles
import withStyles from '@material-ui/core/styles/withStyles';
import { styles } from './styles';

// @material-ui
import CircularProgress from '@material-ui/core/CircularProgress';

// components 
import TableHeader from '../header';
import NotData from '../../not-data';
import TableListItem from '../list-item';

const Skeleton = dynamic(() => import('react-skeleton-loader'), { loading: () => <div></div>, ssr: false });
import PaginationArrow from '../../../../components/pagination-arrow/PaginationArrow';

const extensions = {
    e1: 'showScroll2Top',
    e2: 'hideScrollFilter',
};

class TableList extends React.PureComponent {

    constructor(props) {
        super(props);
        const { columns, resizeable } = props;
        this.state = {
            columnSizes: resizeable ? getTableColumnSizes(columns) : {},
            isColumnResized: false,
            isRenderListFinish: false,
            showScroll2Top: false,
            hideScrollFilter: false,
            firstIndexSelected: null,
        };
        this.compRefs = {}; // wrapper, container, collapse;
        this.compData = { lastScrollLeft: 0 };
    }

    componentDidMount() {
        this.props.onRef(this.compRefs);
    }

    componentDidUpdate(prevProps) {
        const { columnSizes } = this.state;
        const { columns, resizeable } = this.props;
        if (resizeable && columnSizes === {} && isArray(columns, true) && !isArray(prevProps.columns, true)) {
            this.setState({ columnSizes: getTableColumnSizes(columns) });
        }
    }

    getOption = (name, defaultValue) => {
        const { options } = this.props;
        return options && options[name] || defaultValue;
    };

    handleToggleCollapse = (ref, status) => {
        const { collapse } = this.compRefs;
        collapse && collapse.updateState({ isCollapse: false });
        this.compRefs.collapse = status ? ref : null;
        if (status) { ref.updateState({ isCollapse: true }); }
    };

    handleToggleShowExtension = (name, status) => {
        const { toggleShowExtension } = this.props;
        if (isFunction(toggleShowExtension)) {
            this.props.toggleShowExtension(name, status);
        }
    };

    handleItemClick = (params) => {
        const { firstIndexSelected, markAction } = this.state;
        let mark = (!params.shift) ? params.index : null;
        this.setState({ firstIndexSelected: mark, markAction: params.id == 'select' ? 'shiftSelect' : 'shiftUnselect' });
        let data = {
            ...params,
            ...(params.shift && !isUndefined(firstIndexSelected) && {
                id: markAction,
                selectedRange: { from: firstIndexSelected, to: params.index }
            }),
        }
        this.props.onItemClick(data)
    }

    handleScroll = (event) => {
        const { hidenScrollFilter } = this.state;
        const { fetching, reachedEndOffset, contents, showPagination } = this.props;
        const { wrapper: wrapperRef, container: containerRef } = this.compRefs;
        const scrollLeft = wrapperRef?.scrollLeft || 0, scrollTop = wrapperRef?.scrollTop || 0, wrapperHeight = wrapperRef.clientHeight || 0, containerHeight = containerRef.clientHeight || 0;
        const onReachedEnd = scrollLeft === this.compData.lastScrollLeft && scrollTop + wrapperHeight >= containerHeight - (reachedEndOffset || 100);
        const showScroll2Top = scrollTop > wrapperHeight / 2;
        this.compData.lastScrollLeft = scrollLeft;
        this.props.onScroll?.({ event, scrollTop, wrapperHeight, containerHeight, onReachedEnd });
        if (!showPagination && onReachedEnd && !fetching && isArray(contents, true)) {
            this.props.onReachedEnd?.();
        }
        if (showScroll2Top !== this.state.showScroll2Top) {
            this.setState({ showScroll2Top });
            this.handleToggleShowExtension(extensions.e1, showScroll2Top);
        }
        if (hidenScrollFilter && scrollTop === 0) {
            this.setState({ hidenScrollFilter: false });
            this.handleToggleShowExtension(extensions.e2, false);
        }
        if (!hidenScrollFilter && scrollTop >= wrapperHeight / 2) {
            this.setState({ hidenScrollFilter: true });
            this.handleToggleShowExtension(extensions.e2, true);
        }
    };

    handleRenderFinish = () => {
        const { isRenderListFinish } = this.state;
        if (!isRenderListFinish) {
            this.setState({ isRenderListFinish: true });
        }
        setTimeout(() => {
            const { contents, showPagination } = this.props;
            const { wrapper: wrapperRef, container: containerRef } = this.compRefs;
            const wrapperHeight = wrapperRef?.clientHeight || 0, containerHeight = containerRef?.clientHeight || 0;
            if (!showPagination && isArray(contents, true) && wrapperHeight && containerHeight && wrapperHeight >= containerHeight) {
                this.props.onReachedEnd();
            }
        }, 10);
    };

    resizeColumnStart = ({ event, index, column }, isTouch) => {
        event.stopPropagation()
        const parentWidth = event.target.parentElement.getBoundingClientRect().width;
        const pageX = isTouch ? event.changedTouches[0].pageX : event.pageX;
        this.setState({ currentlyResizing: { index, column, id: column.id, startX: pageX, parentWidth } }, () => {
            const endEvent = isTouch ? 'touchend' : 'mouseleave';
            const moveEvent = isTouch ? 'touchmove' : 'mousemove';
            const cancelEvent = isTouch ? 'touchcancel' : 'mouseup';
            document.addEventListener(endEvent, this.resizeColumnEnd);
            document.addEventListener(cancelEvent, this.resizeColumnEnd);
            document.addEventListener(moveEvent, this.resizeColumnMoving);
        });
    };

    resizeColumnMoving = (event) => {
        event.stopPropagation();
        const { fetching, contents } = this.props;
        const noneContent = !fetching && !isArray(contents, true);
        if (!noneContent) {
            const { index, column, parentWidth, startX } = this.state.currentlyResizing;
            let pageX, minWidth = column.minWidth || 100;
            if (event.type === 'touchmove') {
                pageX = event.changedTouches[0].pageX;
            } else if (event.type === 'mousemove') {
                pageX = event.pageX;
            }
            const newWidth = Math.max(parentWidth + pageX - startX, minWidth);
            this.setState(state => ({ isColumnResized: true, columnSizes: { ...state.columnSizes, [index]: { updated: true, size: newWidth } } }));
        }
    };

    resizeColumnEnd = (event) => {
        event.stopPropagation()
        const isTouch = event.type === 'touchend' || event.type === 'touchcancel';
        if (isTouch) {
            document.removeEventListener('touchmove', this.resizeColumnMoving);
            document.removeEventListener('touchcancel', this.resizeColumnEnd);
            document.removeEventListener('touchend', this.resizeColumnEnd);
        }
        // If its a touch event clear the mouse one's as well because sometimes
        // the mouseDown event gets called as well, but the mouseUp event doesn't
        document.removeEventListener('mousemove', this.resizeColumnMoving);
        document.removeEventListener('mouseup', this.resizeColumnEnd);
        document.removeEventListener('mouseleave', this.resizeColumnEnd);
        // The touch events don't propagate up to the sorting's onMouseDown event so
        // no need to prevent it from happening or else the first click after a touch
        // event resize will not sort the column.
        if (!isTouch) { this.setState({ currentlyResizing: false }); }
    };

    _renderContentHeader = () => {
        const { isColumnResized, columnSizes } = this.state;
        const { fetching, contents, columns, selectable, resizeable, header, actions, showPagination, options } = this.props;
        const noneContent = !fetching && !isArray(contents, true);
        const headerProps = {
            columns, selectable, resizeable, noneContent, showPagination, tableOptions: options,
            actions, columnSizes, isColumnResized,
            bgColor: this.getOption('bgHeaderColor'),
            noPadding: this.getOption('noHeaderPadding'),
            onClick: this.props.onHeaderClick,
            onSortChange: this.props.onSortChange,
            resizeColumnStart: this.resizeColumnStart,
            ...header,
        };
        return <TableHeader {...headerProps} />;
    };

    _renderFetchingSkeleton = (num) => {
        const { classes, skeleton } = this.props;
        const { amount } = skeleton;
        let skeletonNodes = [];
        for (let i = 0; i < (num || amount || 15); i++) {
            skeletonNodes.push(
                <div key={i} className={classes.skeletonRow}>
                    <Skeleton widthRandomness={0} borderRadius={10} height={'44px'} width={'100%'} />
                </div>
            );
        }
        return skeletonNodes;
    };

    _getContainerProps = () => {
        const { isColumnResized } = this.state;
        const { classes, resizeable, fetching, contents } = this.props;
        const noneContent = !fetching && !isArray(contents, true);
        return {
            ref: ref => { if (ref) this.compRefs.container = ref },
            className: classes.container,
            style: {
                minWidth: noneContent ? 'calc(100% - 64px)' : '100%',
                width: resizeable && isColumnResized ? 'fit-content' : 'unset',
                padding: `68px ${noneContent ? 32 : 0}px 8px`,
            },
        };
    };

    _renderContentStatus = () => {
        const { virtualFetching } = this.state;
        const { contents, fetching, skeleton, pagination } = this.props;
        const { page_size } = pagination?.data || {};
        if (isArray(contents, true) && !virtualFetching) { return null; }
        let statusNode = null;
        if (fetching || virtualFetching) {
            if (!skeleton || skeleton.hide === true) { return null; }
            statusNode = this._renderFetchingSkeleton(page_size);
        } else {
            statusNode = <NotData flatBg={this.getOption('notDataFlatBg')} />;
        }
        return <div {...this._getContainerProps()}>{statusNode}</div>;
    };

    _renderContentList = () => {
        const { columnSizes, virtualFetching } = this.state;
        const { contents, columns, selectedUuids, actions, selectable, resizeable, header, multiline,
            itemCustomComp, disbaleItemSelectable, disbaleItemViewDetail, columnDataFormat, collapse, contextMenu, options, subContent } = this.props;
        if (!isArray(contents, true) || virtualFetching) { return null; }
        return (
            <div {...this._getContainerProps()}>
                {contents.map((content, index) => {
                    if (!content || content?.is_deleted) { return null; }
                    const isSelected = selectedUuids.indexOf(content.uuid) === -1 ? false : true;
                    const isLastItem = index === contents.length - 1;
                    const itemProps = {
                        itemIndex: index,
                        columns, content, isSelected, selectedUuids, isLastItem, actions,
                        selectable, resizeable, columnSizes, header, multiline, itemCustomComp,
                        disbaleItemSelectable, disbaleItemViewDetail, columnDataFormat, collapse, contextMenu, options, subContent,
                        showSelectedShadow: this.getOption('showSelectedShadow'),
                        onItemClick: this.handleItemClick,
                        onHeaderClick: this.props.onHeaderClick,
                        onRenderFinish: this.handleRenderFinish,
                        onToggleCollapse: this.handleToggleCollapse,
                    };
                    return <TableListItem key={index} {...itemProps} />;
                })}
            </div>
        );
    };

    _renderPagination = () => {
        const { classes, showPagination, contents, pagination, fetching } = this.props;
        const { isRenderListFinish } = this.state;
        if (showPagination && (fetching || (isArray(contents, true) && !fetching)) && isRenderListFinish) {
            return (
                <div className={classes.paginationContainer}>
                    <PaginationArrow forTableList
                        unit={pagination?.unit}
                        fetching={fetching}
                        pagination={pagination?.data}
                        currentItem={(contents || []).length}
                        handleGoToPage={this.props.goToPage}
                        fectchingData={virtualFetching => this.setState({ virtualFetching })}
                    />
                </div>
            );
        }
        return;
    }

    _renderContentIndicator = () => {
        const { classes, showPagination, hideIndicator, contents, fetching } = this.props;
        if (!hideIndicator && !showPagination && isArray(contents, true) && fetching) {
            return (
                <div className={classes.progress_view}>
                    <CircularProgress className={classes.progress} />
                </div>
            );
        }
        return;
    };

    render() {
        const { isRenderListFinish } = this.state;
        const { classes, style, resizeable, fetching, skeleton, contents, showAddBtn, notFullscreen, showPagination } = this.props;
        const noneBottom = this.getOption('noWrapperBottom');
        const wrapperStyle = {
            overflowX: resizeable && isRenderListFinish ? 'auto' : 'hidden',
            overflowY: !isArray(contents, true) && fetching && skeleton && !skeleton.hide ? 'hidden' : 'auto',
            paddingBottom: (noneBottom || showPagination) ? 8 : (showAddBtn ? 80 : 20),
            marginBottom: (noneBottom || showPagination) ? 0 : 6,
            ...((!notFullscreen && !showPagination) && { flex: 1, height: '100%' }),
            ...style,
        };
        const listProps = {
            ref: ref => { if (ref) this.compRefs.wrapper = ref },
            style: wrapperStyle,
            className: classes.wrapper,
            onScroll: this.handleScroll,
        };
        return (
            <Fragment>
                <div {...listProps}>
                    {this._renderContentHeader()}
                    {this._renderContentList()}
                    {this._renderContentStatus()}
                    {this._renderContentIndicator()}
                </div>
                {this._renderPagination()}
            </Fragment>
        );
    }

}

TableList.propTypes = {
    columns: PropTypes.any, // { code: PropTypes.string, name: PropTypes.string, col: PropTypes.number, align: PropTypes.string, width: PropTypes.number, minWidth: PropTypes.number, sortable: { type: PropTypes.string /*avatar, image*/, isDefault: PropTypes.bool }, Comp: (className, item, index) => {} },
    contents: PropTypes.any,
    skeleton: PropTypes.shape({
        hide: PropTypes.bool,
        amount: PropTypes.number,
    }),
    fetching: PropTypes.bool,
    hideIndicator: PropTypes.bool,
    selectedUuids: PropTypes.array,
    actions: PropTypes.array, // { id: String, text: String, icon: ImageNode, style: Css, Cell: ()=> {} }
    reachedEndOffset: PropTypes.number,
    onRef: PropTypes.func,
    onItemClick: PropTypes.func,
    onHeaderClick: PropTypes.func,
    onSortChange: PropTypes.func,
    onScroll: PropTypes.func,
    onReachedEnd: PropTypes.func,
    toggleShowExtension: PropTypes.func, // type: showScroll2Top, hideScrollFilter;
    selectable: PropTypes.bool,
    resizeable: PropTypes.bool,
    header: PropTypes.object,  // all availble props for TableHeader;
    multiline: PropTypes.bool, // allow row item display content as multiline;
    showAddBtn: PropTypes.bool,
    notFullscreen: PropTypes.bool,
    itemCustomComp: PropTypes.any, // render any thing you want in each list item, but don't break any other conent of component, thanks;
    disbaleItemSelectable: PropTypes.any, // disable select item dynamic for each list item with custom condition;
    disbaleItemViewDetail: PropTypes.any, // disable viewDetail event dynamic for each list item with custom condition;
    columnDataFormat: PropTypes.any, // custom format text data for each column;
    style: PropTypes.object, // css for table wrapper;
    options: PropTypes.shape({
        bgHeaderColor: PropTypes.any, // background-color for header wrapper;
        notDataFlatBg: PropTypes.bool, // remove NotData component's backgroundColor;
        noWrapperBottom: PropTypes.bool, // remove marginBottom and paddingBottom for wrapper;
        showSelectedShadow: PropTypes.bool, // add shadow for selected list item;
        noHeaderPadding: PropTypes.bool, // remove header padding;
        itemStyle: PropTypes.object, // style for item container. "padding" attribute required "width" => (padding, width: 'calc(100% - (paddingLeft + paddingRight)));

    }),
    showPagination: PropTypes.bool, // requied pagination of list
    pagination: PropTypes.shape({
        data: PropTypes.object,
        unit: PropTypes.string,
    }),
    collapse: PropTypes.any,
    contextMenu: PropTypes.any,
};

TableList.defaultProps = {
    actions: [],
    contents: null,
    fetching: false,
    showAddBtn: true,
    selectedUuids: [],
    skeleton: { hide: false, amount: 15 },
    onRef: () => { },
    onScroll: () => { },
    goToPage: () => { },
    onItemClick: () => { },
    onSortChange: () => { },
    onReachedEnd: () => { },
    onHeaderClick: () => { },
    toggleShowExtension: () => { },
};

export default withStyles(styles)(TableList);