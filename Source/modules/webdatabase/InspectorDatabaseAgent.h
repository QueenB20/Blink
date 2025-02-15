/*
 * Copyright (C) 2010 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef InspectorDatabaseAgent_h
#define InspectorDatabaseAgent_h

#include "core/InspectorFrontend.h"
#include "core/inspector/InspectorBaseAgent.h"
#include "platform/heap/Handle.h"
#include "wtf/HashMap.h"
#include "wtf/PassOwnPtr.h"
#include "wtf/text/WTFString.h"

namespace blink {

class Database;
class DocumentLoader;
class LocalFrame;
class InspectorDatabaseResource;
class InspectorFrontend;
class InstrumentingAgents;

typedef String ErrorString;

class InspectorDatabaseAgent FINAL : public InspectorBaseAgent<InspectorDatabaseAgent>, public InspectorBackendDispatcher::DatabaseCommandHandler {
public:
    static PassOwnPtrWillBeRawPtr<InspectorDatabaseAgent> create()
    {
        return adoptPtrWillBeNoop(new InspectorDatabaseAgent());
    }
    virtual ~InspectorDatabaseAgent();
    virtual void trace(Visitor*) OVERRIDE;

    virtual void setFrontend(InspectorFrontend*) OVERRIDE;
    virtual void clearFrontend() OVERRIDE;
    virtual void restore() OVERRIDE;

    virtual void didCommitLoadForMainFrame() OVERRIDE;

    // Called from the front-end.
    virtual void enable(ErrorString*) OVERRIDE;
    virtual void disable(ErrorString*) OVERRIDE;
    virtual void getDatabaseTableNames(ErrorString*, const String& databaseId, RefPtr<TypeBuilder::Array<String> >& names) OVERRIDE;
    virtual void executeSQL(ErrorString*, const String& databaseId, const String& query, PassRefPtrWillBeRawPtr<ExecuteSQLCallback>) OVERRIDE;

    void didOpenDatabase(Database*, const String& domain, const String& name, const String& version);
private:
    explicit InspectorDatabaseAgent();

    Database* databaseForId(const String& databaseId);
    InspectorDatabaseResource* findByFileName(const String& fileName);

    InspectorFrontend::Database* m_frontend;
    typedef PersistentHeapHashMapWillBeHeapHashMap<String, Member<InspectorDatabaseResource> > DatabaseResourcesHeapMap;
    DatabaseResourcesHeapMap m_resources;
    bool m_enabled;
};

} // namespace blink

#endif // !defined(InspectorDatabaseAgent_h)
