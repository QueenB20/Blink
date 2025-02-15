// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef DeviceSingleWindowEventController_h
#define DeviceSingleWindowEventController_h

#include "core/frame/DOMWindowLifecycleObserver.h"
#include "core/frame/PlatformEventController.h"
#include "platform/heap/Handle.h"

namespace blink {

class Document;
class Event;

class DeviceSingleWindowEventController : public NoBaseWillBeGarbageCollectedFinalized<DeviceSingleWindowEventController>, public PlatformEventController, public DOMWindowLifecycleObserver {
    WILL_BE_USING_GARBAGE_COLLECTED_MIXIN(DeviceSingleWindowEventController);
public:
    virtual ~DeviceSingleWindowEventController();

    // Inherited from DeviceEventControllerBase.
    virtual void didUpdateData() OVERRIDE;
    virtual void trace(Visitor*);

    // Inherited from DOMWindowLifecycleObserver.
    virtual void didAddEventListener(LocalDOMWindow*, const AtomicString&) OVERRIDE;
    virtual void didRemoveEventListener(LocalDOMWindow*, const AtomicString&) OVERRIDE;
    virtual void didRemoveAllEventListeners(LocalDOMWindow*) OVERRIDE;

protected:
    explicit DeviceSingleWindowEventController(Document&);

    void dispatchDeviceEvent(const PassRefPtrWillBeRawPtr<Event>);

    virtual PassRefPtrWillBeRawPtr<Event> lastEvent() const = 0;
    virtual const AtomicString& eventTypeName() const = 0;
    virtual bool isNullEvent(Event*) const = 0;

private:
    Document& document() const { return *m_document; }

    bool m_needsCheckingNullEvents;
    RawPtrWillBeMember<Document> m_document;
};

} // namespace blink

#endif // DeviceSingleWindowEventController_h
