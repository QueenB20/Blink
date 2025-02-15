/*
 * Copyright (C) 2011 Ericsson AB. All rights reserved.
 * Copyright (C) 2013 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"

#include "platform/mediastream/MediaStreamDescriptor.h"

#include "platform/UUID.h"

namespace blink {

MediaStreamDescriptor* MediaStreamDescriptor::create(const MediaStreamSourceVector& audioSources, const MediaStreamSourceVector& videoSources)
{
    return new MediaStreamDescriptor(createCanonicalUUIDString(), audioSources, videoSources);
}

MediaStreamDescriptor* MediaStreamDescriptor::create(const MediaStreamComponentVector& audioComponents, const MediaStreamComponentVector& videoComponents)
{
    return new MediaStreamDescriptor(createCanonicalUUIDString(), audioComponents, videoComponents);
}

MediaStreamDescriptor* MediaStreamDescriptor::create(const String& id, const MediaStreamComponentVector& audioComponents, const MediaStreamComponentVector& videoComponents)
{
    return new MediaStreamDescriptor(id, audioComponents, videoComponents);
}

void MediaStreamDescriptor::addComponent(MediaStreamComponent* component)
{
    switch (component->source()->type()) {
    case MediaStreamSource::TypeAudio:
        if (m_audioComponents.find(component) == kNotFound)
            m_audioComponents.append(component);
        break;
    case MediaStreamSource::TypeVideo:
        if (m_videoComponents.find(component) == kNotFound)
            m_videoComponents.append(component);
        break;
    }
}

void MediaStreamDescriptor::removeComponent(MediaStreamComponent* component)
{
    size_t pos = kNotFound;
    switch (component->source()->type()) {
    case MediaStreamSource::TypeAudio:
        pos = m_audioComponents.find(component);
        if (pos != kNotFound)
            m_audioComponents.remove(pos);
        break;
    case MediaStreamSource::TypeVideo:
        pos = m_videoComponents.find(component);
        if (pos != kNotFound)
            m_videoComponents.remove(pos);
        break;
    }
}

void MediaStreamDescriptor::addRemoteTrack(MediaStreamComponent* component)
{
    if (m_client)
        m_client->addRemoteTrack(component);
    else
        addComponent(component);
}

void MediaStreamDescriptor::removeRemoteTrack(MediaStreamComponent* component)
{
    if (m_client)
        m_client->removeRemoteTrack(component);
    else
        removeComponent(component);
}

MediaStreamDescriptor::MediaStreamDescriptor(const String& id, const MediaStreamSourceVector& audioSources, const MediaStreamSourceVector& videoSources)
    : m_client(nullptr)
    , m_id(id)
    , m_ended(false)
{
    ASSERT(m_id.length());
    for (size_t i = 0; i < audioSources.size(); i++)
        m_audioComponents.append(MediaStreamComponent::create(audioSources[i]));

    for (size_t i = 0; i < videoSources.size(); i++)
        m_videoComponents.append(MediaStreamComponent::create(videoSources[i]));
}

// The disposer pattern actually makes the deletion of the extra data happen
// earlier and not later. The disposer makes sure that the extra data is
// destructed in weak processing which is run before sweeping and therefore
// all the objects are still alive and can be touched.
//
// FIXME: Oilpan: This disposer pattern is duplicated in a lot of places.
// We should create a good abstraction class for this and remove the code duplication.
class MediaStreamDescriptorDisposer {
public:
    explicit MediaStreamDescriptorDisposer(MediaStreamDescriptor& descriptor) : m_descriptor(descriptor) { }
    ~MediaStreamDescriptorDisposer()
    {
        m_descriptor.dispose();
    }

private:
    MediaStreamDescriptor& m_descriptor;
};

typedef HeapHashMap<WeakMember<MediaStreamDescriptor>, OwnPtr<MediaStreamDescriptorDisposer> > DescriptorDisposers;

static DescriptorDisposers& descriptorDisposers()
{
    DEFINE_STATIC_LOCAL(Persistent<DescriptorDisposers>, disposers, (new DescriptorDisposers));
    return *disposers;
}

MediaStreamDescriptor::MediaStreamDescriptor(const String& id, const MediaStreamComponentVector& audioComponents, const MediaStreamComponentVector& videoComponents)
    : m_client(nullptr)
    , m_id(id)
    , m_ended(false)
{
    ASSERT(m_id.length());
    for (MediaStreamComponentVector::const_iterator iter = audioComponents.begin(); iter != audioComponents.end(); ++iter)
        m_audioComponents.append((*iter));
    for (MediaStreamComponentVector::const_iterator iter = videoComponents.begin(); iter != videoComponents.end(); ++iter)
        m_videoComponents.append((*iter));
    descriptorDisposers().add(this, adoptPtr(new MediaStreamDescriptorDisposer(*this)));
}

void MediaStreamDescriptor::dispose()
{
    m_extraData = nullptr;
}

void MediaStreamDescriptor::trace(Visitor* visitor)
{
    visitor->trace(m_audioComponents);
    visitor->trace(m_videoComponents);
    visitor->trace(m_client);
}

} // namespace blink

