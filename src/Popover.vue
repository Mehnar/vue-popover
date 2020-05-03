<template>
  <div
    ref="mainContainer"
    :class="{
      opened: status === STATUS_OPEN,
      closed: status === STATUS_CLOSE,
    }"
    class="popover"
  >
    <slot name="target"/>
    <div
      v-if="status === STATUS_OPEN"
      ref="popover"
      :style="{
        ...styleProps,
        'position': fixed ? 'fixed' : 'absolute',
        'width': isModeSelect ? `${localWidth}px` : `${width}px`,
        'left': `${left}px`,
        'top': `${top}px`,
      }"
      :class="{
        'placement-left': localPlacement === $const.PLACEMENT_LEFT,
        'placement-left-top': localPlacement === $const.PLACEMENT_LEFT_TOP,
        'placement-left-bottom': localPlacement === $const.PLACEMENT_LEFT_BOTTOM,

        'placement-top-left': localPlacement === $const.PLACEMENT_TOP_LEFT,
        'placement-top': localPlacement === $const.PLACEMENT_TOP,
        'placement-top-right': localPlacement === $const.PLACEMENT_TOP_RIGHT,

        'placement-right-top': localPlacement === $const.PLACEMENT_RIGHT_TOP,
        'placement-right': localPlacement === $const.PLACEMENT_RIGHT,
        'placement-right-bottom': localPlacement === $const.PLACEMENT_RIGHT_BOTTOM,

        'placement-bottom-left': localPlacement === $const.PLACEMENT_BOTTOM_LEFT,
        'placement-bottom': localPlacement === $const.PLACEMENT_BOTTOM,
        'placement-bottom-right': localPlacement === $const.PLACEMENT_BOTTOM_RIGHT,

        'without-arrow': (mode === $const.MODE_SELECT || withoutArrow),
        'popover-unclose-outer': !localCloseOuterClick && showCross,
        'popover-right-selected': localPlacement === $const.PLACEMENT_RIGHT_SELECTED,
      }"
      class="body-popover"
    >
      <i
        v-if="!localCloseOuterClick && showCross"
        class="el-icon-circle-close popover-close"
        @click="manualClosePopover"
      />
      <div
        class="popover-inner"
      >
        <slot/>
      </div>
    </div>
  </div>
</template>

<script>
import throttle from 'lodash/throttle';
import Bus from './popoverBus';

const STATUS_CLOSE = 'close';
const STATUS_OPEN = 'open';

const DEFAULT_MARGIN = 10;

const MODE_DEFAULT = 'default';
const MODE_SELECT = 'select';

const $positions = {
  PLACEMENT_RIGHT,
  PLACEMENT_RIGHT_BOTTOM,

  PLACEMENT_BOTTOM_RIGHT,
  PLACEMENT_BOTTOM,
  PLACEMENT_BOTTOM_LEFT,

  PLACEMENT_LEFT_BOTTOM,
  PLACEMENT_LEFT,
  PLACEMENT_LEFT_TOP,

  PLACEMENT_TOP_LEFT,
  PLACEMENT_TOP,
  PLACEMENT_TOP_RIGHT,

  PLACEMENT_RIGHT_TOP,
};

export default {
  name: 'Popover',
  props: {
    defaultPlacement: {
      type: String,
      default() { return this.$const.PLACEMENT_BOTTOM_RIGHT; },
    },
    placements: {
      type: Array,
      default() {
        return [
          this.$const.PLACEMENT_RIGHT,
          this.$const.PLACEMENT_RIGHT_BOTTOM,

          this.$const.PLACEMENT_BOTTOM_RIGHT,
          this.$const.PLACEMENT_BOTTOM,
          this.$const.PLACEMENT_BOTTOM_LEFT,

          this.$const.PLACEMENT_LEFT_BOTTOM,
          this.$const.PLACEMENT_LEFT,
          this.$const.PLACEMENT_LEFT_TOP,

          this.$const.PLACEMENT_TOP_LEFT,
          this.$const.PLACEMENT_TOP,
          this.$const.PLACEMENT_TOP_RIGHT,

          this.$const.PLACEMENT_RIGHT_TOP,
        ];
      },
    },
    width: {
      type: Number,
      default: 300,
    },
    closeOuterClick: {
      type: Boolean,
      default: true,
    },
    showCross: {
      type: Boolean,
      default: true,
    },
    styleProps: {
      type: Object,
      default: () => ({}),
    },
    mode: {
      type: String,
      default: MODE_DEFAULT,
    },
    outerElementSelector: {
      type: String,
      default: 'body',
    },
    withoutArrow: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      localWidth: 0,
      top: 0,
      left: 0,
      target: null,
      index: null,
      fixed: false,
      isMouseDown: false,
      isMouseDownAndScroll: false,
      status: STATUS_CLOSE,
      coords: null,
      outerElement: document.querySelector(this.outerElementSelector),
      localPlacement: this.defaultPlacement,
      localCloseOuterClick: this.closeOuterClick,
      passPlacements: [],
      placementsAvailableSpace: {},

      STATUS_CLOSE,
      STATUS_OPEN,

      DEFAULT_MARGIN,
      MODE_DEFAULT,
      MODE_SELECT,
    };
  },
  computed: {
    otherPlacements() {
      return this.placements.filter(item => item !== this.localPlacement && !this.passPlacements.includes(item));
    },
    isModeSelect() {
      return this.mode === this.$const.MODE_SELECT;
    },
  },
  watch: {
    disabled(newVal) {
      if (!newVal) {
        Bus.$on(`popover-${this.index}:open`, this.openPopover);
        Bus.$on(`popover-${this.index}:close`, this.manualClosePopover);
      } else {
        Bus.$off(`popover-${this.index}:open`, this.openPopover);
        Bus.$off(`popover-${this.index}:close`, this.manualClosePopover);
      }
    },
  },
  created() {
    this.throttledUpdatePosition = throttle(this.updatePosition, 100);
    this.$on('close-popover', this.manualClosePopover);
    this.$on('update-popover', this.throttledUpdatePosition);

    if (this.isModeSelect) {
      this.localPlacement = this.$const.PLACEMENT_BOTTOM;
    }
  },
  mounted() {
    this.target = this.$slots.target[0].elm;
    this.index = JSON.parse(this.target.dataset.index);
    if (!this.disabled) {
      Bus.$on(`popover-${this.index}:open`, this.openPopover);
      Bus.$on(`popover-${this.index}:close`, this.manualClosePopover);
    }
  },
  beforeDestroy() {
    if (!this.disabled) {
      this.manualClosePopover();
      Bus.$off(`popover-${this.index}:open`, this.openPopover);
      Bus.$off(`popover-${this.index}:close`, this.manualClosePopover);
    }
    this.$off('close-popover', this.manualClosePopover);
    this.$off('update-popover', this.throttledUpdatePosition);
    this.throttledUpdatePosition.cancel();
  },
  methods: {
    manualClosePopover() {
      this.localCloseOuterClick = true;
      this.closePopover();
    },
    async updatePosition() {
      if (this.status === STATUS_OPEN) {
        if (this.isModeSelect) {
          this.localWidth = this.$slots.target[0].elm.clientWidth || this.width;
        }
        this.passPlacements = [];
        await this.calculatePosition();

        if (!this.isModeSelect) {
          await this.checkPlacement();
        } else if (this.fixed) {
          await this.$nextTick();
          const outerOffsets = this.outerElement.getBoundingClientRect();
          const mainContainerOffset = this.$refs.mainContainer.getBoundingClientRect();
          const isVisiblePopoverContainer = this.isVisiblePopoverContainer(outerOffsets, mainContainerOffset);
          if (!isVisiblePopoverContainer) {
            this.closePopover();
          }
        }
      }
    },
    async calculatePosition() {
      await this.$nextTick();
      if (!this.$refs.popover) return;

      this.coords = this.$refs.mainContainer.getBoundingClientRect();
      const { height, width } = this.coords;
      const top = this.fixed ? this.coords.top : 0;
      const left = this.fixed ? this.coords.left : 0;
      const heightPopover = this.$refs.popover.getBoundingClientRect().height;

      if (this.localPlacement === this.$const.PLACEMENT_LEFT_BOTTOM) {
        this.top = (Math.round(top) + Math.round(height / 2)) - Math.round(heightPopover * 0.05);
        this.left = Math.round(left) - Math.round(this.width) - this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_LEFT) {
        this.top = Math.round(top) + (Math.round(height / 2) - (heightPopover / 2));
        this.left = Math.round(left) - Math.round(this.width) - this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_LEFT_TOP) {
        this.top = Math.round(top) + (Math.round(height / 2) - heightPopover) + Math.round(heightPopover * 0.05);
        this.left = Math.round(left) - Math.round(this.width) - this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_TOP_LEFT) {
        this.top = Math.round(top) - Math.round(heightPopover) - this.DEFAULT_MARGIN;
        this.left = (Math.round(left) - Math.round(this.width)) + Math.round(width / 2) + Math.round(this.width * 0.05);

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_TOP) {
        this.top = Math.round(top) - Math.round(heightPopover) - this.DEFAULT_MARGIN;
        this.left = Math.round(left) + (Math.round(width / 2) - Math.round(this.width / 2));

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_TOP_RIGHT) {
        this.top = Math.round(top) - Math.round(heightPopover) - this.DEFAULT_MARGIN;
        this.left = Math.round(left) + (Math.round(width / 2) - Math.round(this.width * 0.05));

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_RIGHT_TOP) {
        this.top = Math.round(top) + (Math.round(height / 2) - heightPopover) + Math.round(heightPopover * 0.05);
        this.left = Math.round(left) + Math.round(width) + this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_RIGHT) {
        this.top = Math.round(top) + (Math.round(height / 2) - (heightPopover / 2));
        this.left = Math.round(left) + Math.round(width) + this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_RIGHT_BOTTOM) {
        this.top = (Math.round(top) + Math.round(height / 2)) - Math.round(heightPopover * 0.05);
        this.left = Math.round(left) + Math.round(width) + this.DEFAULT_MARGIN;

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_BOTTOM_RIGHT) {
        this.top = Math.round(top) + Math.round(height) + this.DEFAULT_MARGIN;
        this.left = Math.round(left) + (Math.round(width / 2) - Math.round(this.width * 0.05));

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_BOTTOM) {
        this.top = Math.round(top) + Math.round(height) + this.DEFAULT_MARGIN;

        if (this.isModeSelect) {
          this.top -= (this.DEFAULT_MARGIN / 2);
        }
        this.left = (Math.round(left) - (Math.round(this.localWidth) / 2)) + (Math.round(width) / 2);

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_BOTTOM_LEFT) {
        this.top = Math.round(top) + Math.round(height) + this.DEFAULT_MARGIN;
        this.left = (Math.round(left) - Math.round(this.width)) + Math.round(width / 2) + Math.round(this.width * 0.05);

        return;
      }

      if (this.localPlacement === this.$const.PLACEMENT_RIGHT_SELECTED) {
        this.top = Math.round(top);
        this.left = (Math.round(left) + Math.round(width)) - 4;

        return;
      }
      this.top = 0;
      this.left = 0;
    },
    async openPopover() {
      window.addEventListener('resize', this.throttledUpdatePosition);
      this.fixed = JSON.parse(this.target.dataset.fixed);
      if (this.fixed) {
        this.outerElement = document.querySelector(this.outerElementSelector);
        window.addEventListener('mousedown', this.mouseDownOuter, true);
        window.addEventListener('scroll', this.scrollOuter, true);
      }
      this.status = this.STATUS_OPEN;
      this.localCloseOuterClick = typeof this.target.dataset.hover === 'undefined' ? this.closeOuterClick : true;
      if (this.localCloseOuterClick) {
        window.addEventListener('click', this.clickOuter, true);
      }
      this.localPlacement = this.defaultPlacement;
      await this.updatePosition();
      this.$emit('open');
    },
    closePopover() {
      if (this.localCloseOuterClick) {
        window.removeEventListener('click', this.clickOuter, true);
      }
      if (this.fixed) {
        window.removeEventListener('scroll', this.scrollOuter, true);
        window.removeEventListener('mousedown', this.mouseDownOuter, true);
      }
      window.removeEventListener('resize', this.throttledUpdatePosition);
      this.status = this.STATUS_CLOSE;
      this.top = 0;
      this.left = 0;
      this.target.dataset.isOpen = false;
      this.passPlacements = [];
      this.isMouseDown = false;
      this.isMouseDownAndScroll = false;
      this.$emit('close');
    },
    mouseDownOuter() {
      this.isMouseDown = true;
    },
    clickOuter(event) {
      if (this.status === STATUS_CLOSE || !this.localCloseOuterClick) return;
      if (!this.$refs.mainContainer.contains(event.target)) {
        if (this.isMouseDownAndScroll) {
          this.isMouseDown = false;
          this.isMouseDownAndScroll = false;
        } else {
          this.closePopover();
        }
      }
    },
    scrollOuter(event) {
      if (this.status === STATUS_CLOSE) return;
      if (!this.fixed) {
        if (!this.$refs.mainContainer.contains(event.target)) {
          this.closePopover();
        }
      } else {
        this.isMouseDownAndScroll = this.isMouseDown;
        this.throttledUpdatePosition();
      }
    },
    isVisiblePopoverContainer(outerOffsets, mainContainerOffset) {
      return (
        mainContainerOffset.top < (outerOffsets.bottom) &&
        mainContainerOffset.left < (outerOffsets.right) &&
        mainContainerOffset.bottom > (outerOffsets.top) &&
        mainContainerOffset.right > (outerOffsets.left)
      );
    },
    isAvailablePlacement() {
      if (!this.$refs.popover) return false;

      const popoverOffsets = this.$refs.popover.getBoundingClientRect();
      let container;

      if (this.fixed) {
        const outerOffsets = this.outerElement.getBoundingClientRect();
        const mainContainerOffset = this.$refs.mainContainer.getBoundingClientRect();
        const isVisiblePopoverContainer = this.isVisiblePopoverContainer(outerOffsets, mainContainerOffset);
        if (!isVisiblePopoverContainer) {
          this.closePopover();
          return false;
        }

        const isAvailablePlacement = (
          popoverOffsets.top > (outerOffsets.top) &&
          popoverOffsets.left > (outerOffsets.left) &&
          popoverOffsets.bottom < (outerOffsets.bottom) &&
          popoverOffsets.right < (outerOffsets.right)
        );

        if (isAvailablePlacement) {
          return true;
        }
        container = {
          top: outerOffsets.top,
          bottom: outerOffsets.bottom,
          left: outerOffsets.left,
          right: outerOffsets.right,
        };
        this.placementsAvailableSpace[this.localPlacement] =
          this.calculateVisibleSpacePopover(container, popoverOffsets);
        return false;
      }

      const isAvailablePlacement = (
        popoverOffsets.top > 20 &&
        popoverOffsets.left > 20 &&
        popoverOffsets.bottom < window.innerHeight - 60 &&
        popoverOffsets.right < window.innerWidth - 20
      );

      if (isAvailablePlacement) {
        return true;
      }
      container = {
        top: 0,
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
      };
      this.placementsAvailableSpace[this.localPlacement] =
        this.calculateVisibleSpacePopover(container, popoverOffsets);
      return false;
    },
    calculateVisibleSpacePopover(container, popoverOffsets) {
      // вычисление площади пересечения поповера с элементом, в пределах которого он должен находиться
      const width = Math.min(container.right, popoverOffsets.right) - Math.max(container.left, popoverOffsets.left);
      const height = Math.min(container.bottom, popoverOffsets.bottom) - Math.max(container.top, popoverOffsets.top);
      if (width < 0 || height < 0) {
        return 0;
      }
      return width * height;
    },
    async checkPlacement() {
      await this.$nextTick();
      const isAvailablePlacement = this.isAvailablePlacement();

      if (!isAvailablePlacement && this.otherPlacements.length && this.status === STATUS_OPEN) {
        const placement = this.otherPlacements[0];

        this.passPlacements.push(this.localPlacement);
        this.localPlacement = placement;
        await this.calculatePosition();
        return this.checkPlacement();
      } else if (!isAvailablePlacement
       && !this.otherPlacements.length && this.status === STATUS_OPEN) {
        const sortedBySpacePlacements = Object.keys(this.placementsAvailableSpace).sort((a, b) =>
          this.placementsAvailableSpace[b] - this.placementsAvailableSpace[a]);
        this.localPlacement = sortedBySpacePlacements[0];
        await this.calculatePosition();
        this.placementsAvailableSpace = {};
      } else {
        this.placementsAvailableSpace = {};
      }
      return Promise.resolve();
    },
  },
};
</script>

<style lang="scss" scoped>
.popover {
  position: relative;
  display: inline-block;
}
.popover-close {
  position: absolute;
  right: 4px;
  top: 4px;
  cursor: pointer;
  color: #f56c6c;
  font-size: 18px;
}

.target-selected {
  border: 1px solid transparent;

  &.opened {
    border-color: $neur-gray;
    border-radius: 0 $default-border-radius $default-border-radius 0;
    background-color: white;
    box-shadow: 5px 6px 3px rgba(173, 176, 184, 0.3);

    &::after {
      content: '';
      height: 100%;
      width: 2px;
      background: white;
      position: absolute;
      right: 1px;
      z-index: 300;
      bottom: 0;
    }
  }
}

.body-popover {
  top: 0;
  left: 0;
  background-color: white;
  box-shadow: 0 15px 20px rgba(173, 176, 184, 0.3);
  border: 1px solid $neur-gray;
  border-radius: $default-border-radius;
  box-sizing: border-box;
  cursor: initial;
  z-index: 200;
}
.popover-right-selected {
  border-radius: 0 5px 5px 5px;
  box-shadow: 5px 6px 3px rgba(173, 176, 184, 0.3);
}
.popover-unclose-outer {
  padding-top: 26px;
}
.body-popover:before,
.body-popover:after {
  position: absolute;
  content: '';
  box-sizing: border-box;
}
.body-popover:before {
  border: 5px solid transparent;
  width: 10px;
  height: 10px;
}
.body-popover:after {
  border: 4px solid transparent;
  width: 8px;
  height: 8px;
}

.placement-left {
  &:before,
  &-top:before,
  &-bottom:before {
    right: -10px;
    border-left: 5px solid #c7d3c7;
  }

  &:after,
  &-top:after,
  &-bottom:after {
    right: -8px;
    border-left: 4px solid #fff;
  }

  &:before {
    top: calc(50% - 4px);
  }
  &:after {
    top: calc(50% - 3px);
  }

  &-top {
    &:before {
      top: calc(100% - (100% * 0.05) - 4px);
    }
    &:after {
      top: calc(100% - (100% * 0.05) - 3px);
    }
  }

  &-bottom {
    &:before {
      top: calc(100% * 0.05 - 4px);
    }
    &:after {
      top: calc(100% * 0.05 - 3px);
    }
  }
}

.placement-top {
  &:before,
  &-left:before,
  &-right::before {
    bottom: -10px;
    border-top: 5px solid #c7d3c7;
  }

  &:after,
  &-left:after,
  &-right:after {
    bottom: -8px;
    border-top: 4px solid #fff;
  }

  &:before {
    left: calc(50% - 4px);
  }
  &:after {
    left: calc(50% - 3px);
  }

  &-right {
    &:before {
      left: calc(100% * 0.05 - 5px);
    }
    &:after {
      left: calc(100% * 0.05 - 4px);
    }
  }

  &-left {
    &:before {
      left: calc(100% - (100% * 0.05 + 5px));
    }
    &:after {
      left: calc(100% - (100% * 0.05 + 4px));
    }
  }
}

.placement-right {
  &:before,
  &-top:before,
  &-bottom::before {
    left: -10px;
    border-right: 5px solid #C7D3D9;
  }

  &:after,
  &-top:after,
  &-bottom:after {
    left: -8px;
    border-right: 4px solid #fff;
  }

  &:before {
    top: calc(50% - 4px);
  }
  &:after {
    top: calc(50% - 3px);
  }

  &-top {
    &:before {
      top: calc(100% - (100% * 0.05) - 4px);
    }
    &:after {
      top: calc(100% - (100% * 0.05) - 3px);
    }
  }

  &-bottom {
    &:before {
      top: calc(100% * 0.05 - 4px);
    }
    &:after {
      top: calc(100% * 0.05 - 3px);
    }
  }
}

.placement-bottom {
  &:before,
  &-left:before,
  &-right::before {
    top: -10px;
    border-bottom: 5px solid #c7d3c7;
  }

  &:after,
  &-left:after,
  &-right:after {
    top: -8px;
    border-bottom: 4px solid #fff;
  }

  &:before {
    left: calc(50% - 4px);
  }
  &:after {
    left: calc(50% - 3px);
  }

  &-right {
    &:before {
      left: calc(100% * 0.05 - 5px);
    }
    &:after {
      left: calc(100% * 0.05 - 4px);
    }
  }

  &-left {
    &:before {
      left: calc(100% - (100% * 0.05 + 5px));
    }
    &:after {
      left: calc(100% - (100% * 0.05 + 4px));
    }
  }
}
.arrow-top:before {
  top: -10px;
  left: calc(100% * 0.05 - 4px);
  border-bottom: 5px solid #c7d3c7;
}
.arrow-top:after {
  top: -8px;
  left: calc(100% * 0.05 - 3px);
  border-bottom: 4px solid #fff;
}

.arrow-top-inverted:before {
  top: -10px;
  left: calc(100% - (100% * 0.05 + 9px));
  border-bottom: 5px solid #c7d3c7;
}
.arrow-top-inverted:after {
  top: -8px;
  left: calc(100% - (100% * 0.05 + 8px));
  border-bottom: 4px solid #fff;
}

.arrow-top-center:before {
  top: -10px;
  left: calc(50% - 4px);
  border-bottom: 5px solid #c7d3c7;
}
.arrow-top-center:after {
  top: -8px;
  left: calc(50% - 3px);
  border-bottom: 4px solid #fff;
}

.without-arrow {
  &::before,
  &::after {
    display: none;
  }
}
</style>
