/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef MediaStreamRegistry_h
#define MediaStreamRegistry_h

#include "core/html/URLRegistry.h"
#include "platform/heap/Handle.h"
#include "wtf/HashMap.h"
#include "wtf/PassRefPtr.h"
#include "wtf/text/StringHash.h"

namespace blink {

class KURL;
class MediaStream;
class MediaStreamDescriptor;

class MediaStreamRegistry FINAL : public URLRegistry {
public:
    // Returns a single instance of MediaStreamRegistry.
    static MediaStreamRegistry& registry();

    // Registers a blob URL referring to the specified stream data.
    virtual void registerURL(SecurityOrigin*, const KURL&, URLRegistrable*) OVERRIDE;
    virtual void unregisterURL(const KURL&) OVERRIDE;
    virtual bool contains(const String&) OVERRIDE;

    MediaStreamDescriptor* lookupMediaStreamDescriptor(const String& url);

private:
    MediaStreamRegistry();
    PersistentHeapHashMap<String, Member<MediaStreamDescriptor> > m_streamDescriptors;
};

} // namespace blink

#endif // MediaStreamRegistry_h
