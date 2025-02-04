/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <UIKit/UIKit.h>

#import <ABI44_0_0React/ABI44_0_0RCTPrimitives.h>

NS_ASSUME_NONNULL_BEGIN

@class ABI44_0_0RCTMountingManager;

/**
 * MountingManager's delegate.
 */
@protocol ABI44_0_0RCTMountingManagerDelegate <NSObject>

/*
 * Called right *before* execution of mount items which affect a Surface with
 * given `rootTag`.
 * Always called on the main queue.
 */
- (void)mountingManager:(ABI44_0_0RCTMountingManager *)mountingManager willMountComponentsWithRootTag:(ABI44_0_0ReactTag)MountingManager;

/*
 * Called right *after* execution of mount items which affect a Surface with
 * given `rootTag`.
 * Always called on the main queue.
 */
- (void)mountingManager:(ABI44_0_0RCTMountingManager *)mountingManager didMountComponentsWithRootTag:(ABI44_0_0ReactTag)rootTag;

@end

NS_ASSUME_NONNULL_END
