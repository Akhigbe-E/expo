/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include "FabricMountingManager.h"

#include <fbjni/fbjni.h>
#include <react/jni/JRuntimeExecutor.h>
#include <react/jni/JRuntimeScheduler.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/renderer/animations/LayoutAnimationDriver.h>
#include <react/renderer/scheduler/Scheduler.h>
#include <react/renderer/scheduler/SchedulerDelegate.h>
#include <react/renderer/uimanager/LayoutAnimationStatusDelegate.h>

#include <memory>
#include <mutex>
#include "ComponentFactory.h"
#include "EventBeatManager.h"
#include "EventEmitterWrapper.h"
#include "JBackgroundExecutor.h"
#include "SurfaceHandlerBinding.h"

namespace facebook {
namespace react {

class Instance;

class Binding : public jni::HybridClass<Binding>,
                public SchedulerDelegate,
                public LayoutAnimationStatusDelegate {
 public:
  constexpr static const char *const kJavaDescriptor =
      "Lcom/facebook/react/fabric/Binding;";

  constexpr static auto ReactFeatureFlagsJavaDescriptor =
      "com/facebook/react/config/ReactFeatureFlags";

  static void registerNatives();

 private:
  void setConstraints(
      jint surfaceId,
      jfloat minWidth,
      jfloat maxWidth,
      jfloat minHeight,
      jfloat maxHeight,
      jfloat offsetX,
      jfloat offsetY,
      jboolean isRTL,
      jboolean doLeftAndRightSwapInRTL);

  jni::local_ref<ReadableNativeMap::jhybridobject> getInspectorDataForInstance(
      jni::alias_ref<EventEmitterWrapper::javaobject> eventEmitterWrapper);

  static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jclass>);

  void installFabricUIManager(
      jni::alias_ref<JRuntimeExecutor::javaobject> runtimeExecutorHolder,
      jni::alias_ref<JRuntimeScheduler::javaobject> runtimeSchedulerHolder,
      jni::alias_ref<jobject> javaUIManager,
      EventBeatManager *eventBeatManager,
      ComponentFactory *componentsRegistry,
      jni::alias_ref<jobject> reactNativeConfig);

  void startSurface(
      jint surfaceId,
      jni::alias_ref<jstring> moduleName,
      NativeMap *initialProps);

  void startSurfaceWithConstraints(
      jint surfaceId,
      jni::alias_ref<jstring> moduleName,
      NativeMap *initialProps,
      jfloat minWidth,
      jfloat maxWidth,
      jfloat minHeight,
      jfloat maxHeight,
      jfloat offsetX,
      jfloat offsetY,
      jboolean isRTL,
      jboolean doLeftAndRightSwapInRTL);

  void renderTemplateToSurface(jint surfaceId, jstring uiTemplate);

  void stopSurface(jint surfaceId);

  void registerSurface(SurfaceHandlerBinding *surfaceHandler);

  void unregisterSurface(SurfaceHandlerBinding *surfaceHandler);

  void schedulerDidFinishTransaction(
      MountingCoordinator::Shared const &mountingCoordinator) override;

  void schedulerDidRequestPreliminaryViewAllocation(
      const SurfaceId surfaceId,
      const ShadowNode &shadowNode) override;

  void schedulerDidCloneShadowNode(
      SurfaceId surfaceId,
      const ShadowNode &oldShadowNode,
      const ShadowNode &newShadowNode) override;

  void schedulerDidDispatchCommand(
      const ShadowView &shadowView,
      std::string const &commandName,
      folly::dynamic const &args) override;

  void schedulerDidSendAccessibilityEvent(
      const ShadowView &shadowView,
      std::string const &eventType) override;

  void schedulerDidSetIsJSResponder(
      ShadowView const &shadowView,
      bool isJSResponder,
      bool blockNativeResponder) override;

  void preallocateView(SurfaceId surfaceId, ShadowNode const &shadowNode);

  void setPixelDensity(float pointScaleFactor);

  void driveCxxAnimations();

  void uninstallFabricUIManager();

  // Private member variables
  butter::shared_mutex installMutex_;
  std::shared_ptr<FabricMountingManager> mountingManager_;
  std::shared_ptr<Scheduler> scheduler_;

  std::shared_ptr<Scheduler> getScheduler();
  std::shared_ptr<FabricMountingManager> verifyMountingManager(
      std::string const &locationHint);

  // LayoutAnimations
  void onAnimationStarted() override;
  void onAllAnimationsComplete() override;

  std::shared_ptr<LayoutAnimationDriver> animationDriver_;

  std::unique_ptr<JBackgroundExecutor> backgroundExecutor_;

  butter::map<SurfaceId, SurfaceHandler> surfaceHandlerRegistry_{};
  butter::shared_mutex
      surfaceHandlerRegistryMutex_; // Protects `surfaceHandlerRegistry_`.

  float pointScaleFactor_ = 1;

  std::shared_ptr<const ReactNativeConfig> reactNativeConfig_{nullptr};
  bool disablePreallocateViews_{false};
  bool enableFabricLogs_{false};
  bool disableRevisionCheckForPreallocation_{false};
  bool enableEventEmitterRawPointer_{false};
  bool dispatchPreallocationInBackground_{false};
};

} // namespace react
} // namespace facebook
