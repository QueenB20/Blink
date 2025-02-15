/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer
 *    in the documentation and/or other materials provided with the
 *    distribution.
 * 3. Neither the name of Google Inc. nor the names of its contributors
 *    may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
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
#include "platform/mediastream/MediaStreamSource.h"


namespace blink {

// The disposer pattern actually makes the deletion of the extra data happen
// earlier and not later. The disposer makes sure that the extra data is
// destructed in weak processing which is run before sweeping and therefore
// all the objects are still alive and can be touched.
//
// FIXME: Oilpan: This disposer pattern is duplicated in a lot of places.
// We should create a good abstraction class for this and remove the code duplication.
class MediaStreamSourceDisposer {
public:
    explicit MediaStreamSourceDisposer(MediaStreamSource& source) : m_source(source) { }
    ~MediaStreamSourceDisposer()
    {
        m_source.dispose();
    }

private:
    MediaStreamSource& m_source;
};

typedef HeapHashMap<WeakMember<MediaStreamSource>, OwnPtr<MediaStreamSourceDisposer> > SourceDisposers;

static SourceDisposers& sourceDisposers()
{
    DEFINE_STATIC_LOCAL(Persistent<SourceDisposers>, disposers, (new SourceDisposers));
    return *disposers;
}

MediaStreamSource* MediaStreamSource::create(const String& id, Type type, const String& name, ReadyState readyState, bool requiresConsumer)
{
    return new MediaStreamSource(id, type, name, readyState, requiresConsumer);
}

MediaStreamSource::MediaStreamSource(const String& id, Type type, const String& name, ReadyState readyState, bool requiresConsumer)
    : m_id(id)
    , m_type(type)
    , m_name(name)
    , m_readyState(readyState)
    , m_requiresConsumer(requiresConsumer)
{
    sourceDisposers().add(this, adoptPtr(new MediaStreamSourceDisposer(*this)));
}

void MediaStreamSource::dispose()
{
    m_extraData = nullptr;
}

void MediaStreamSource::setReadyState(ReadyState readyState)
{
    if (m_readyState != ReadyStateEnded && m_readyState != readyState) {
        m_readyState = readyState;
        for (HeapHashSet<WeakMember<Observer> >::iterator i = m_observers.begin(); i != m_observers.end(); ++i)
            (*i)->sourceChangedState();
    }
}

void MediaStreamSource::addObserver(MediaStreamSource::Observer* observer)
{
    ASSERT(!m_observers.contains(observer));
    m_observers.add(observer);
}

void MediaStreamSource::addAudioConsumer(AudioDestinationConsumer* consumer)
{
    ASSERT(m_requiresConsumer);
    MutexLocker locker(m_audioConsumersLock);
    m_audioConsumers.add(consumer);
}

bool MediaStreamSource::removeAudioConsumer(AudioDestinationConsumer* consumer)
{
    ASSERT(m_requiresConsumer);
    MutexLocker locker(m_audioConsumersLock);
    HeapHashSet<Member<AudioDestinationConsumer> >::iterator it = m_audioConsumers.find(consumer);
    if (it == m_audioConsumers.end())
        return false;
    m_audioConsumers.remove(it);
    return true;
}

void MediaStreamSource::setAudioFormat(size_t numberOfChannels, float sampleRate)
{
    ASSERT(m_requiresConsumer);
    MutexLocker locker(m_audioConsumersLock);
    for (HeapHashSet<Member<AudioDestinationConsumer> >::iterator it = m_audioConsumers.begin(); it != m_audioConsumers.end(); ++it)
        (*it)->setFormat(numberOfChannels, sampleRate);
}

void MediaStreamSource::consumeAudio(AudioBus* bus, size_t numberOfFrames)
{
    ASSERT(m_requiresConsumer);
    MutexLocker locker(m_audioConsumersLock);
    for (HeapHashSet<Member<AudioDestinationConsumer> >::iterator it = m_audioConsumers.begin(); it != m_audioConsumers.end(); ++it)
        (*it)->consumeAudio(bus, numberOfFrames);
}

void MediaStreamSource::trace(Visitor* visitor)
{
    visitor->trace(m_observers);
    visitor->trace(m_audioConsumers);
}

} // namespace blink

